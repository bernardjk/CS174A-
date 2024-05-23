import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

export class SpaceRacer extends Scene {
    constructor() {
        super();

        this.shapes = {
            car: new defs.Cube(),
            track:new defs.Torus(30, 30)
        };

        this.materials = {
            car: new Material(new defs.Phong_Shader(), {ambient: 1, diffusivity: 0.5, specularity: 0.5, color: hex_color("#FF0000")}),
            track: new Material(new defs.Phong_Shader(), {ambient: 0.5, diffusivity: 0.5, specularity: 0.5, color: hex_color("#808080")}),
        };

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
        this.car_transform = Mat4.translation(0, 1, 0);

        this.key_states = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
        this.velocity = 0;
        this.acceleration = 0.002;  // Acceleration rate
        this.deceleration = 0.003;  // Deceleration rate
        this.max_speed = 0.1;       // Max speed
    }

    make_control_panel() {
        this.key_triggered_button("Move Forward", ["ArrowUp"], () => this.key_states.ArrowUp = true, undefined, () => this.key_states.ArrowUp = false);
        this.key_triggered_button("Move Backward", ["ArrowDown"], () => this.key_states.ArrowDown = true, undefined, () => this.key_states.ArrowDown = false);
        this.key_triggered_button("Turn Left", ["ArrowLeft"], () => this.key_states.ArrowLeft = true, undefined, () => this.key_states.ArrowLeft = false);
        this.key_triggered_button("Turn Right", ["ArrowRight"], () => this.key_states.ArrowRight = true, undefined, () => this.key_states.ArrowRight = false);
    }

    display(context, program_state) {
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, .1, 1000);
        const t = program_state.animation_time / 1000;

        // Add a simple light source
        const light_position = vec4(0, 10, 10, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

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
