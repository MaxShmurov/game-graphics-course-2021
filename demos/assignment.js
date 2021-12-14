// Final assignment 

import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import {mat4, vec3, mat3, vec4, vec2} from "../node_modules/gl-matrix/esm/index.js";

import {positions, normals, uvs, indices} from "../blender/brofistsmall.js"
import {positions as mirrorPositions, uvs as mirrorUvs, indices as mirrorIndices} from "../blender/plane.js"

let skyboxPositions = new Float32Array([
    -1.0, 1.0, 1.0,
    1.0, 1.0, 1.0,
    -1.0, -1.0, 1.0,
    1.0, -1.0, 1.0
]);

let skyboxTriangles = new Uint32Array([
    0, 2, 1,
    2, 3, 1
]);

let ambientLightColor = vec3.fromValues(0.1, 0.8, 0.55);
let numberOfLights = 2;
let lightColors = [vec3.fromValues(0.30, 0.0, 0.2), vec3.fromValues(0.1, 0.7, 0.7), vec3.fromValues(1.0, 0.5, 0.6)];
let lightInitialPositions = [vec3.fromValues(-50, 0, 50), vec3.fromValues(50, 0, 50)];
let lightPositions = [vec3.create(), vec3.create(), vec3.create()];

let lightCalculationShader = `
    uniform vec3 cameraPos;
    uniform vec3 ambientLightColor;    
    uniform vec3 lightColors[${numberOfLights}];        
    uniform vec3 lightPositions[${numberOfLights}];
    
    // This function calculates light reflection using Phong reflection model (ambient + diffuse + specular)
    vec4 calculateLights(vec3 normal, vec3 position) {
        vec3 viewDirection = normalize(cameraPos.xyz - position);
        vec4 color = vec4(ambientLightColor, 1.0);
                
        for (int i = 0; i < lightPositions.length(); i++) {
            vec3 lightDirection = normalize(lightPositions[i] - position);
            
            // Lambertian reflection (ideal diffuse of matte surfaces) is also a part of Phong model                        
            float diffuse = max(dot(lightDirection, normal), 0.0);                                    
                      
            // Phong specular highlight 
            float specular = pow(max(dot(viewDirection, reflect(-lightDirection, normal)), 0.9), 50.0);
            
            // Blinn-Phong improved specular highlight                        
            //float specular = pow(max(dot(normalize(lightDirection + viewDirection), normal), 0.0), 200.0);
            
            color.rgb += lightColors[i] * diffuse + specular;
        }
        return color;
    }
`;


// language=GLSL
let fragmentShader = `
#version 300 es
precision highp float;
${lightCalculationShader}

uniform sampler2D tex;
//uniform samplerCube cubemap;    

in vec2 vUv;
// in vec3 vPosition; 
in vec3 vNormal;
in vec3 viewDir;

out vec4 outColor;

void main()
{        
    vec3 reflectedDir = reflect(viewDir, normalize(vNormal));
    // outColor = texture(cubemap, reflectedDir);  //?
    // outColor = calculateLights(normalize(vNormal), vPosition);
    outColor = calculateLights(normalize(vNormal), viewDir) * texture(tex, vUv);
    
    // Try using a higher mipmap LOD to get a rough material effect without any performance impact
    //outColor = textureLod(cubemap, reflectedDir, 7.0);
}
`;

// language=GLSL
let vertexShader = `
    #version 300 es
    ${lightCalculationShader} // ?
            
    uniform mat4 modelViewProjectionMatrix;
    uniform mat4 modelMatrix;
    uniform mat3 normalMatrix;
    uniform vec3 cameraPosition; 
    
    
    layout(location=0) in vec4 position;
    layout(location=1) in vec3 normal;
    layout(location=2) in vec2 uv;
    
    out vec3 vPosition;
    out vec2 vUv;
    out vec3 vNormal;
    out vec3 viewDir;
    out vec4 vColor;
    
    void main()
    {
        gl_Position = modelViewProjectionMatrix * position;           
        vUv = uv;
        viewDir = (modelMatrix * position).xyz - cameraPosition;                
        vNormal = normalMatrix * normal;
        vColor = calculateLights(normalize(vNormal), vPosition);
    }
`;

// language=GLSL
let mirrorFragmentShader = `
    #version 300 es
    precision highp float;
    
    uniform sampler2D reflectionTex;
    uniform sampler2D distortionMap;
    uniform vec2 screenSize;
    
    in vec2 vUv;        
        
    out vec4 outColor;
    
    void main()
    {                        
        vec2 screenPos = gl_FragCoord.xy / screenSize;
        
        // 0.03 is a mirror distortion factor, try making a larger distortion         
        screenPos.x += (texture(distortionMap, vUv).r - 0.5) * 0.03;
        outColor = texture(reflectionTex, screenPos) ;
    }
`;

// language=GLSL
let mirrorVertexShader = `
    #version 300 es
            
    uniform mat4 modelViewProjectionMatrix;
    
    layout(location=0) in vec4 position;   
    layout(location=1) in vec2 uv;
    
    out vec2 vUv;
        
    void main()
    {
        vUv = uv;
        gl_Position = modelViewProjectionMatrix * position;           
    }
`;

// language=GLSL
let skyboxFragmentShader = `
    #version 300 es
    precision mediump float;
    
    uniform samplerCube cubemap;
    uniform mat4 viewProjectionInverse;
    
    in vec4 v_position;
    
    out vec4 outColor;
    
    void main() {
      vec4 t = viewProjectionInverse * v_position;
      outColor = texture(cubemap, normalize(t.xyz / t.w));
    }
`;

// language=GLSL
let skyboxVertexShader = `
    #version 300 es
    
    layout(location=0) in vec4 position;
    out vec4 v_position;
    
    void main() {
      v_position = position;
      gl_Position = position;
    }
`;

let program = app.createProgram(vertexShader.trim(), fragmentShader.trim());
let skyboxProgram = app.createProgram(skyboxVertexShader, skyboxFragmentShader);
let mirrorProgram = app.createProgram(mirrorVertexShader, mirrorFragmentShader);

let vertexArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, positions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 3, normals))
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, uvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, indices));

let skyboxArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, skyboxPositions))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, skyboxTriangles));

let mirrorArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, mirrorPositions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 2, mirrorUvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, mirrorIndices));

// Change the reflection texture resolution to checkout the difference
let reflectionResolutionFactor = 0.5;
let reflectionColorTarget = app.createTexture2D(app.width * reflectionResolutionFactor, app.height * reflectionResolutionFactor, {magFilter: PicoGL.LINEAR});
let reflectionDepthTarget = app.createTexture2D(app.width * reflectionResolutionFactor, app.height * reflectionResolutionFactor, {internalFormat: PicoGL.DEPTH_COMPONENT16});
let reflectionBuffer = app.createFramebuffer().colorTarget(0, reflectionColorTarget).depthTarget(reflectionDepthTarget);

let projMatrix = mat4.create();
let viewMatrix = mat4.create();
let viewProjMatrix = mat4.create();
let modelMatrix = mat4.create();
let modelViewMatrix = mat4.create();
let modelViewProjectionMatrix = mat4.create();
let rotateXMatrix = mat4.create();
let rotateYMatrix = mat4.create();
let mirrorModelMatrix = mat4.create();
let mirrorModelViewProjectionMatrix = mat4.create();
let skyboxViewProjectionInverse = mat4.create();
let cameraPosition = vec3.create();

const positionsBuffer = new Float32Array(numberOfLights * 3);
const colorsBuffer = new Float32Array(numberOfLights * 3);

function calculateSurfaceReflectionMatrix(reflectionMat, mirrorModelMatrix, surfaceNormal) {
    let normal = vec3.transformMat3(vec3.create(), surfaceNormal, mat3.normalFromMat4(mat3.create(), mirrorModelMatrix));
    let pos = mat4.getTranslation(vec3.create(), mirrorModelMatrix);
    let d = -vec3.dot(normal, pos);
    let plane = vec4.fromValues(normal[0], normal[1], normal[2], d);

    reflectionMat[0] = (1 - 2 * plane[0] * plane[0]);
    reflectionMat[4] = ( - 2 * plane[0] * plane[1]);
    reflectionMat[8] = ( - 2 * plane[0] * plane[2]);
    reflectionMat[12] = ( - 2 * plane[3] * plane[0]);

    reflectionMat[1] = ( - 2 * plane[1] * plane[0]);
    reflectionMat[5] = (1 - 2 * plane[1] * plane[1]);
    reflectionMat[9] = ( - 2 * plane[1] * plane[2]);
    reflectionMat[13] = ( - 2 * plane[3] * plane[1]);

    reflectionMat[2] = ( - 2 * plane[2] * plane[0]);
    reflectionMat[6] = ( - 2 * plane[2] * plane[1]);
    reflectionMat[10] = (1 - 2 * plane[2] * plane[2]);
    reflectionMat[14] = ( - 2 * plane[3] * plane[2]);

    reflectionMat[3] = 0;
    reflectionMat[7] = 0;
    reflectionMat[11] = 0;
    reflectionMat[15] = 1;

    return reflectionMat;
}

async function loadTexture(fileName) {
    return await createImageBitmap(await (await fetch("images/" + fileName)).blob());
}

(async () => {
    const cubemap = app.createCubemap({
        negX: await loadTexture("nx.jpg"),
        posX: await loadTexture("px.jpg"),
        negY: await loadTexture("ny.jpg"),
        posY: await loadTexture("py.jpg"),
        negZ: await loadTexture("nz.jpg"),
        posZ: await loadTexture("pz.jpg")
    });



    let drawCall = app.createDrawCall(program, vertexArray)
        .texture("tex", app.createTexture2D(await loadTexture("happyface2.jpeg")))
        //.texture("cubemap", cubemap)
        .uniform("ambientLightColor", ambientLightColor);

    let skyboxDrawCall = app.createDrawCall(skyboxProgram, skyboxArray)
        .texture("cubemap", cubemap);

    let mirrorDrawCall = app.createDrawCall(mirrorProgram, mirrorArray)
        .texture("reflectionTex", reflectionColorTarget)
        .texture("distortionMap", app.createTexture2D(await loadTexture("noise.png")));

    function renderReflectionTexture()
    {
        app.drawFramebuffer(reflectionBuffer);
        app.viewport(0, 0, reflectionColorTarget.width, reflectionColorTarget.height);

        app.gl.cullFace(app.gl.FRONT);

        let reflectionMatrix = calculateSurfaceReflectionMatrix(mat4.create(), mirrorModelMatrix, vec3.fromValues(0, 1, 0));
        let reflectionViewMatrix = mat4.mul(mat4.create(), viewMatrix, reflectionMatrix);
        let reflectionCameraPosition = vec3.transformMat4(vec3.create(), cameraPosition, reflectionMatrix);
        drawObjects(reflectionCameraPosition, reflectionViewMatrix);

        app.gl.cullFace(app.gl.BACK);
        app.defaultDrawFramebuffer();
        app.defaultViewport();
    }

    function drawObjects(cameraPosition, viewMatrix) {
        mat4.multiply(viewProjMatrix, projMatrix, viewMatrix);

        mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
        mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);

        let skyboxView = mat4.clone(viewMatrix);
        skyboxView[12] = 0;
        skyboxView[13] = 0;
        skyboxView[14] = 0;
        let skyboxViewProjectionMatrix = mat4.create();
        mat4.mul(skyboxViewProjectionMatrix, projMatrix, skyboxView);
        mat4.invert(skyboxViewProjectionInverse, skyboxViewProjectionMatrix);

        app.clear();

        app.disable(PicoGL.DEPTH_TEST);
        app.gl.cullFace(app.gl.FRONT);
        skyboxDrawCall.uniform("viewProjectionInverse", skyboxViewProjectionInverse);
        skyboxDrawCall.draw();

 

        app.enable(PicoGL.DEPTH_TEST);

        drawCall.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix);
        drawCall.uniform("cameraPosition", cameraPosition);
        drawCall.uniform("modelMatrix", modelMatrix);
        drawCall.uniform("normalMatrix", mat3.normalFromMat4(mat3.create(), modelMatrix));
        mat4.fromRotationTranslationScale(modelMatrix, rotateYMatrix, vec3.fromValues(0, 1, -0.5), [0.300, -0.300, 0.300]);
        drawCall.draw();




    }

    function drawMirror() {
        mat4.multiply(mirrorModelViewProjectionMatrix, viewProjMatrix, mirrorModelMatrix);
        mirrorDrawCall.uniform("modelViewProjectionMatrix", mirrorModelViewProjectionMatrix);
        mirrorDrawCall.uniform("screenSize", vec2.fromValues(app.width, app.height))
        mirrorDrawCall.draw();
    }

    function draw() {
        let time = new Date().getTime() * 0.001;

        mat4.perspective(projMatrix, Math.PI / 1.6, app.width / app.height, 0.1, 100.0);
        vec3.rotateY(vec3.create(), vec3.fromValues(0, 0.5, 2), vec3.fromValues(0, 0, 0), time * 0.05);
        vec3.rotateY(cameraPosition, vec3.fromValues(0, 3, 3.5), vec3.fromValues(0, 0, 0), time * 0.05);
        mat4.lookAt(viewMatrix, cameraPosition, vec3.fromValues(0, 1.2, 0), vec3.fromValues(0, 1, 0));

        let camPos = vec3.rotateY(vec3.create(), vec3.fromValues(3, 3, 3), vec3.fromValues(0, 0, 0), time * -0.05);
        mat4.lookAt(viewMatrix, camPos, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
        mat4.multiply(viewProjMatrix, projMatrix, viewMatrix);

        mat4.fromXRotation(rotateXMatrix, time * 0.1136 - Math.PI / 2);
        mat4.fromZRotation(rotateYMatrix, time * 0.2235);
        mat4.mul(modelMatrix, rotateXMatrix, rotateYMatrix);

        mat4.fromXRotation(rotateXMatrix, 0.3);
        mat4.fromYRotation(rotateYMatrix, time * 0.9);
        mat4.mul(mirrorModelMatrix, rotateYMatrix, rotateXMatrix);
        mat4.translate(mirrorModelMatrix, mirrorModelMatrix, vec3.fromValues(0, -1, 0));

        for (let i = 0; i < numberOfLights; i++) {
            vec3.rotateY(lightPositions[i], lightInitialPositions[i], vec3.fromValues(0, 0, 0), time * 5.0);
            positionsBuffer.set(lightPositions[i], i * 3);
            colorsBuffer.set(lightColors[i], i * 3);
        }

        drawCall.uniform("lightPositions[0]", positionsBuffer);
        drawCall.uniform("lightColors[0]", colorsBuffer);




        renderReflectionTexture();
        drawObjects(cameraPosition, viewMatrix);
        drawMirror();

        requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
})();