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
        };
    })
    .catch((err) => {
        console.error(`${err.name}: ${err.message}`);
    });
