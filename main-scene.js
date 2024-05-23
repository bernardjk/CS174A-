import {defs, tiny} from './examples/common.js';
import {SpaceRacer} from "./SpaceRacer.js";

// Pull these names into this module's scope for convenience:
const {
    Vector, Vector3, vec, vec3, vec4, color, Matrix, Mat4, Light, Shape, Material, Shader, Texture, Scene,
    Canvas_Widget, Code_Widget, Text_Widget
} = tiny;

// Now we have loaded everything in the files tiny-graphics.js, tiny-graphics-widgets.js, and common.js.
// This yielded "tiny", an object wrapping the stuff in the first two files, and "defs" for wrapping all the rest.

Object.assign(defs, {SpaceRacer});

// Define Main_Scene's class here
const Main_Scene = SpaceRacer;
const Additional_Scenes = [];

export {Main_Scene, Additional_Scenes, Canvas_Widget, Code_Widget, Text_Widget, defs}
