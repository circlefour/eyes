import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;

let faceLandmarker;
let webcamEnabled = false;

let leftx = 0, lefty = 0;
let rightx = 0, righty = 0;

let rightEyes = [];
const EYES_NUM = 50;

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

    const vid_constr = {
        width: { ideal: 1920, max: 2560 },  // Target HD/4K if available
        height: { ideal: 1080, max: 1440 },
        frameRate: { ideal: 30 } // Maintain smoothness
    }

    const constraints = {
        audio: false,
        video: vid_constr,
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

    // this matches the width and height of the video stream's native resolution: default camera settings
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    //canvas.width = window.innerWidth;
    //canvas.height = window.innerHeight;

    const results = faceLandmarker.detectForVideo(video, performance.now());
    // just accessing the first identified face with 0 here
    // thinking about it, if more people are present, it would be cool to have other people's eyes in there too.
    const rightBlink = results.faceBlendshapes[0]?.categories.find(shape => 
        shape.categoryName == "eyeBlinkRight"
    ).score ?? 0;
    
    if (rightBlink >= 0.5) {
        randomizeLoc();
    }
    //console.log("eye blink right:",  rightBlink);

    if (results.faceLandmarks) {
        //console.log(results);
        const drawingUtils = new DrawingUtils(ctx);

        for (const landmarks of results.faceLandmarks) {
            let src, dest;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const rightEyePixels = getPxTrace(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, landmarks, canvas.width, canvas.height);
            //src = { "x": 0, "y": 0, "width": canvas.width, "height": canvas.height };
            //drawEye(video, canvas, rightEyePixels, src, src);

            const leftEyePixels = getPxTrace(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, landmarks, canvas.width, canvas.height);
            //drawEye(video, canvas, leftEyePixels, src, src);

            // test
            const bounds = getBounds(leftEyePixels);
            drawToTemp(bounds, video);
            let x = leftx, y = lefty;
            const newShift = shift(x, y, leftEyePixels, bounds);
            src = { "x": 0, "y": 0, "width": temp.width, "height": temp.height };
            dest = {"x": x, "y": y, "width": temp.width, "height": temp.height };
            drawEye(temp, canvas, newShift, src, dest);
            
            // right test
            drawShiftedEye(rightx, righty, rightEyePixels, video, canvas);

            // draw 100 eyes
            rightEyes.forEach(eye => {
                drawShiftedEye(eye.x, eye.y, rightEyePixels, video, canvas);
            });

        }
    }
    requestAnimationFrame(predictWebcam);
}

function drawShiftedEye(x, y, landmarks, video, canvas) {
    const bounds = getBounds(landmarks);
    drawToTemp(bounds, video);
    const newShift = shift(x, y, landmarks, bounds);
    const src = { "x": 0, "y": 0, "width": temp.width, "height": temp.height };
    const dest = {"x": x, "y": y, "width": temp.width, "height": temp.height };
    //console.log(`canvas width: ${canvas.width}, canvas height: ${canvas.height}`);
    //console.log(`temp width: ${temp.width}, temp height: ${temp.height}`);
    drawEye(temp, canvas, newShift, src, dest);
}

document.getElementById("randomize").addEventListener("click", randomizeLoc);

// actually i don't even want to handle out of bounds because the eye looks cool when it's half off screen
// i actually kind of want to make negative values possible too. up to eye width.
function randomizeLoc() {
    const canvas = document.getElementById("output");
    leftx = getRandomInt(canvas.width + 1);
    lefty = getRandomInt(canvas.height+ 1);
    rightx = getRandomInt(canvas.width + 1);
    righty = getRandomInt(canvas.height+ 1);

    rightEyes.forEach(eye => {
        eye.x = getRandomInt(canvas.width + 1);
        eye.y = getRandomInt(canvas.height + 1);
    });
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

// could either just not render if out of bounds, or shift until it's within bounds
function outOfBounds(bounds, canvas) {
    if (bounds.x < 0 || bounds.y < 0) return true;
    const width = bounds.xmax - bounds.xmin;
    const height = bounds.ymax - bounds.ymin;
    if (width > canvas.width || height > canvas.height) return true;
    return false;
}

// x and y are the coordinate points on the canvas the eye is being shifted to, not the shift ammount
function shiftToValid(bounds, x, y) {
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (bounds.xmax + x > canvas.width) {
        const over = bounds.xmax + x - canvas.width;
        x -= over;
    }
    if (bounds.ymax + y > canvas.height) {
        const over = bounds.ymax + y - canvas.height;
        y -= over;
    }
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

// FIXME: is it when the width or height is 0 that it gets fucked up?
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

    if (eyeWidth === 0 || eyeHeight === 0) console.log("HUH?!");

    try {
        tempCtx.drawImage(video,
            bounds.xmin, bounds.ymin, temp.width, temp.height,
            0, 0, temp.width, temp.height);
    } catch (error) {
        // just to see what's up here, if this is perhaps the problem
        console.log('eye width: ', eyeWidth);
        console.log('eye height: ', eyeHeight);

        console.error(error);
    }
}

// creating 100 right eyes for the fun of it
function create100eyes() {
    const canvas = document.getElementById("output");
    for (let i = 0; i < EYES_NUM; i++) {
        rightEyes.push({ "x": getRandomInt(canvas.width + 1), "y": getRandomInt(canvas.height + 1) });
    }
}
create100eyes();

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

    try {
        ctx.drawImage(image,
            src.x, src.y, src.width, src.height,
            dest.x, dest.y, dest.width, dest.height);
    } catch (error) {
        console.log('WHAT IS THIS');
        console.log(image);
        console.error(error);
    }

    ctx.restore();
}

document.getElementById("enable").addEventListener("click", enableCam);
