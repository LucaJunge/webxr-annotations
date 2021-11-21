# webxr-annotations

DOM annotations in webxr

## ToDo

### Alignment of 3D-Space and DOM annotations:

- DOM annotations seem to be about 0.05 3D Units above the actual 3d objects

Tried out:

- positioning the DOM Element with top/left and transform: translate(x, y)
- updating the camera with camera.updateWorldMatrix() / .updateMatrixWorld
