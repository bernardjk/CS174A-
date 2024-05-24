import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

export class SpaceRacer extends Scene {
    constructor() {
        super();

        this.shapes = {
        };

        this.materials = {

        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
    }

    make_control_panel() {
        this.key_triggered_button("Move Forward", ["ArrowUp"], () => this.key_states.ArrowUp = true, undefined, () => this.key_states.ArrowUp = false);
        this.key_triggered_button("Move Backward", ["ArrowDown"], () => this.key_states.ArrowDown = true, undefined, () => this.key_states.ArrowDown = false);
        this.key_triggered_button("Turn Left", ["ArrowLeft"], () => this.key_states.ArrowLeft = true, undefined, () => this.key_states.ArrowLeft = false);
        this.key_triggered_button("Turn Right", ["ArrowRight"], () => this.key_states.ArrowRight = true, undefined, () => this.key_states.ArrowRight = false);
    }

    getRandomInt(max) {
        return Math.floor(Math.random() * max);
      }

    generate_obstacles(context,program_state,number){
            let obs_transform = Mat4.identity();
            obs_transform = obs_transform.times(Mat4.translation(7.5, 7.5, 0));
            this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
            obs_transform = obs_transform.times(Mat4.translation(-9,1, 0));
            this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
            obs_transform = obs_transform.times(Mat4.translation(-6,-3, 0));
            this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
            obs_transform = obs_transform.times(Mat4.translation(0,-5, 0));
            this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
            obs_transform = obs_transform.times(Mat4.translation(-2,-5, 0));
            this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
            obs_transform = obs_transform.times(Mat4.translation(5,-6, 0));
            this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
            obs_transform = obs_transform.times(Mat4.translation(5,0, 0));
            this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
            obs_transform = obs_transform.times(Mat4.translation(3,5, 0));
            this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
            obs_transform = obs_transform.times(Mat4.translation(6,5, 0));
            this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
    }
    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            program_state.set_camera(this.initial_camera_location);
        }

        // TODO: Create Planets (Requirement 1)
        // this.shapes.[XXX].draw([XXX]) // <--example
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);
        

        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

    }
}

class Gouraud_Shader extends Shader {
    // This is a Shader using Phong_Shader as template
    // TODO: Modify the glsl coder here to create a Gouraud Shader (Planet 2)

    constructor(num_lights = 2) {
        super();
        this.num_lights = num_lights;
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return ` 
        precision mediump float;
        const int N_LIGHTS = ` + this.num_lights + `;
        uniform float ambient, diffusivity, specularity, smoothness;
        uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
        uniform float light_attenuation_factors[N_LIGHTS];
        uniform vec4 shape_color;
        uniform vec3 squared_scale, camera_center;

        // Update car transformation based on key states
        if (this.key_states.ArrowUp) {
            this.velocity = Math.min(this.max_speed, this.velocity + this.acceleration);
        } else if (this.key_states.ArrowDown) {
            this.velocity = Math.max(-this.max_speed, this.velocity - this.acceleration);
        } else {
            if (this.velocity > 0) {
                this.velocity = Math.max(0, this.velocity - this.deceleration);
            } else if (this.velocity < 0) {
                this.velocity = Math.min(0, this.velocity + this.deceleration);
            }
        }

        // Move the car
        if (this.velocity !== 0) {
            this.car_transform.post_multiply(Mat4.translation(0, 0, -this.velocity));
            if (this.key_states.ArrowLeft) {
                this.car_transform.post_multiply(Mat4.rotation(0.02, 0, 1, 0)); // Reduced rotation amount
            }
            if (this.key_states.ArrowRight) {
                this.car_transform.post_multiply(Mat4.rotation(-0.02, 0, 1, 0)); // Reduced rotation amount
            }
        }

        // Draw the placeholder track
        const track_transform = Mat4.identity().times(Mat4.scale(10, 0, 10)); // Flatten the torus
        this.shapes.track.draw(context, program_state, track_transform, this.materials.track);

        // Draw the car
        this.shapes.car.draw(context, program_state, this.car_transform, this.materials.car);

        // Implement camera controls
        if (this.attached) {
            let desired = Mat4.inverse(this.attached().times(Mat4.translation(0, 0, 5)));
            program_state.set_camera(desired);
        } else {
            program_state.set_camera(this.initial_camera_location);
        }
    }
}

