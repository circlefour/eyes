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
            drawingUtils.drawConnectors(
                landmarks,
                FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
                { color: "#FF3030", lineWidth: 1 }
            );
            drawingUtils.drawConnectors(
                landmarks,
                FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
                { color: "#FF3030", lineWidth: 1 }
            );
            
            FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE.forEach(({ start }) => {
                console.log("landmarks: ", landmarks);
                console.log("index: ", start);
                const landmark = landmarks[start];
                const x = landmark.x * video.videoWidth;
                const y = landmark.y * video.videoHeight;

                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            });

            const eyeWidth = maxX - minX;
            const eyeHeight = maxY - minY;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, minX, minY, eyeWidth, eyeHeight, 0, 0, eyeWidth*10, eyeHeight*10);

            const rightEyeCoords = FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE.map(({ start }) => landmarks[start]);
            console.log("right eye coordinates: ", rightEyeCoords);

            const rightEyePixels = rightEyeCoords.map(pt => ({
                x: pt.x * canvas.width,
                y: pt.y * canvas.height
            }));
            console.log("right eye pixels: ", rightEyePixels);

        }
    }
    requestAnimationFrame(predictWebcam);
}

document.getElementById("enable").addEventListener("click", enableCam);
