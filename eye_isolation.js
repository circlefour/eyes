import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;

let faceLandmarker;
let webcamEnabled = false;

async function createFaceLandmarker() {
    const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
    });
}
createFaceLandmarker();

function enableCam() {
    const video = document.getElementById("video");
    if (video.srcObject) {
        webcamEnabled = false;
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        return;
    }

    const constraints = {
        audio: false,
        video: true,
    };
    
    navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                video.play();
                webcamEnabled = true;
                video.addEventListener("loadeddata", predictWebcam);
            };
        })
        .catch((err) => {
            console.error(`${err.name}: ${err.message}`);
        });
}

async function predictWebcam() {
    if (!webcamEnabled) return;
    if (!faceLandmarker) {
        requestAnimationFrame(predictWebcam);
        return;
    }

    const canvas = document.getElementById("output");
    const ctx = canvas.getContext("2d");
    
    const video = document.getElementById("video");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const results = faceLandmarker.detectForVideo(video, performance.now());

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    if (results.faceLandmarks) {
        const drawingUtils = new DrawingUtils(ctx);

        for (const landmarks of results.faceLandmarks) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const rightEyePixels = getPxTrace(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, landmarks, canvas.width, canvas.height);
            drawEye(video, canvas, rightEyePixels);

            const leftEyePixels = getPxTrace(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, landmarks, canvas.width, canvas.height);
            drawEye(video, canvas, leftEyePixels);

        }
    }
    requestAnimationFrame(predictWebcam);
}

function getPxTrace(featureLandmarks, faceLandmarks, width, height) {
    const coords = featureLandmarks.map(({ start }) => faceLandmarks[start]);
    const pixelLoc = coords.map(pt => ({
        x: pt.x * width,
        y: pt.y * height
    }));
    return pixelLoc;
}

function drawEye(image, canvas, eyeLandmarks) {
    console.log('canvas: ', canvas);
    console.log('image: ', image);
    console.log('eye landmarks: ', eyeLandmarks);
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(eyeLandmarks[0].x, eyeLandmarks[0].y);
    console.log(`first landmarks are at ${eyeLandmarks[0].x} and ${eyeLandmarks[0].y}`);
    console.log(`last landmarks are at ${eyeLandmarks[eyeLandmarks.length - 1].x} and ${eyeLandmarks[eyeLandmarks.length - 1].y}`);
    //for (const landmark of eyeLandmarks) {
    //    ctx.lineTo(landmark.x, landmark.y);
    //    ctx.fillRect(landmark.x, landmark.y,1,1);
    //}

    // specific to this model i think, not sure how coordinates are mapped in other models
    for (let i = 1; i < eyeLandmarks.length/2; i++){
        ctx.lineTo(eyeLandmarks[i].x, eyeLandmarks[i].y);
        //ctx.fillText(i, eyeLandmarks[i].x, eyeLandmarks[i].y);
    }
    for (let i = eyeLandmarks.length-1; i > eyeLandmarks.length/2; i--) {
        ctx.lineTo(eyeLandmarks[i].x, eyeLandmarks[i].y);
        //ctx.fillText(i, eyeLandmarks[i].x, eyeLandmarks[i].y);
    }
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    ctx.restore();
}

document.getElementById("enable").addEventListener("click", enableCam);
