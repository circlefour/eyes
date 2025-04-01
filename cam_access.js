import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;

let faceLandmarker;

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
    const constraints = {
        audio: false,
        video: true,
    };
    
    navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
            const video = document.getElementById("video");
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                video.play();
                video.addEventListener("loadeddata", predictWebcam);
            };
        })
        .catch((err) => {
            console.error(`${err.name}: ${err.message}`);
        });
}
enableCam();

async function predictWebcam() {
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (results.faceLandmarks) {
        const drawingUtils = new DrawingUtils(ctx);
        for (const landmarks of results.faceLandmarks) {
            drawingUtils.drawConnectors(
                landmarks,
                FaceLandmarker.FACE_LANDMARKS_TESSELATION,
                { color: "#C0C0C070", lineWidth: 1 }
            );
        }
    }
    requestAnimationFrame(predictWebcam);
}


