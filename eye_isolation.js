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
    //console.log('video width: ', video.videoWidth);

    // this matches the width and height of the video stream's native resolution: default camera settings
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // video element display size
    //canvas.width = video.clientWidth;
    //canvas.height = video.clientHeight;

    const results = faceLandmarker.detectForVideo(video, performance.now());

    if (results.faceLandmarks) {
        const drawingUtils = new DrawingUtils(ctx);

        for (const landmarks of results.faceLandmarks) {
            let src, dest;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const rightEyePixels = getPxTrace(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, landmarks, canvas.width, canvas.height);
            src = { "x": 0, "y": 0, "width": canvas.width, "height": canvas.height };
            drawEye(video, canvas, rightEyePixels, src, src);

            const leftEyePixels = getPxTrace(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, landmarks, canvas.width, canvas.height);
            drawEye(video, canvas, leftEyePixels, src, src);

            // test
            const bounds = getBounds(leftEyePixels);
            //console.log("logging bounds: ", bounds);
            drawToTemp(bounds, video);
            let x = 0, y = 0;
            const newShift = shift(x, y, leftEyePixels, bounds);
            src = { "x": 0, "y": 0, "width": temp.width, "height": temp.height };
            dest = {"x": x, "y": y, "width": temp.width, "height": temp.height };
            drawEye(temp, canvas, newShift, src, dest);

        }
    }
    requestAnimationFrame(predictWebcam);
}

function getBounds(pixelLoc) {
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    pixelLoc.forEach((element) => {
        xMin = Math.min(xMin, element.x);
        xMax = Math.max(xMax, element.x);
        yMin = Math.min(yMin, element.y);
        yMax = Math.max(yMax, element.y);
    });

    // i want to get top corner, width and height
    // top corner : xmin, ymin
    // width = xmax-xmin, height = ymax-ymin

    const bounds = {
        "xmin": xMin,
        "ymin": yMin,
        "xmax": xMax,
        "ymax": yMax
    }

    return bounds;
}

// this is actually interesting af because it just shifts the contour, but it doesn't redraw the pixels associated with the eye there. so basically, it uncovers from whatever is in the frame in the shape of the eye.
function shift(x, y, pixelLoc, eyeBounds) {
    // new location - old location = shift ammount
    const xshift = x - eyeBounds.xmin;
    const yshift = y - eyeBounds.ymin;

    return pixelLoc.map(px => ({
        x: px.x + xshift,
        y: px.y + yshift
    }));
}

const temp = document.createElement('canvas');
const tempCtx = temp.getContext('2d');

function drawToTemp(bounds, video) {
    const eyeWidth  = bounds.xmax - bounds.xmin;
    const eyeHeight = bounds.ymax - bounds.ymin;

    // honestly negligible performance improvement, like eye size is prolly gonna be changing a lot
    if (temp.width !== eyeWidth || temp.height !== eyeHeight) {
        temp.width = eyeWidth;
        temp.height = eyeHeight;
    } else {
        tempCtx.clearRect(0, 0, eyeWidth, eyeHeight);
    }

    tempCtx.drawImage(video,
        bounds.xmin, bounds.ymin, temp.width, temp.height,
        0, 0, temp.width, temp.height);
}

function getPxTrace(featureLandmarks, faceLandmarks, width, height) {
    const coords = featureLandmarks.map(({ start }) => faceLandmarks[start]);
    const pixelLoc = coords.map(pt => ({
        x: pt.x * width,
        y: pt.y * height
    }));
    return pixelLoc;
}

function drawEye(image, canvas, eyeLandmarks, src, dest) {
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(eyeLandmarks[0].x, eyeLandmarks[0].y);

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

    ctx.drawImage(image,
        src.x, src.y, src.width, src.height,
        dest.x, dest.y, dest.width, dest.height);

    ctx.restore();
}

document.getElementById("enable").addEventListener("click", enableCam);
