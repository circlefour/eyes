# the void stares back
eyes is a front end visual experiment currently written
in vanilla javascript, html, and css. it uses
[mediapipe face landmark detection](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)
to detect eyes via webcam, isolate them, and redraw them across
the screen.
when you blink, the system recognizes it and the location of the eyes shift.

t h i s i s n ' t the e n d o f i t t h o u g h . . . ( i d ea ll y)

## how it works atm
1. requests camera access
2. uses mediapipe's face mesh to detect eyes in the video feed
3. isolates the right eye from the video frame and draws it to a temporary canvas
4. re-draws the eye 50 times on a canvas
5. detects a blink by 
