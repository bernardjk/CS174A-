import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;
// COLLISION DETECTION CLASS
export class Body {
    // **Body** can store and update the properties of a 3D body that incrementally
    // moves from its previous place due to velocities.  It conforms to the
    // approach outlined in the "Fix Your Timestep!" blog post by Glenn Fiedler.
    constructor(shape, material, size) {
      Object.assign(this, { shape, material, size })
    }
  
    // To check if a collision occurs, we could use either intersect_cube or
    //intersect_sphere, depend on the shape of an targeted object
    //These two methods check if a point is inside a cube or a sphere so that
    //we can determine whether a collision happen or not.
    //we use margin to allow some flexibility as these methods are not perfectly accurate
    static intersect_cube(p, margin = 0) {
      return p.every((value) => value >= -1 - margin && value <= 1 + margin)
    }
  
    static intersect_sphere(p, margin = 0) {
      return p.dot(p) < 1 + margin
    }
  
    emplace(
      location_matrix,
      linear_velocity,
      angular_velocity,
      spin_axis = vec3(0, 0, 0).randomized(1).normalized()
    ) {
      // emplace(): assign the body's initial values, or overwrite them.
      this.center = location_matrix.times(vec4(0, 0, 0, 1)).to3()
      this.rotation = Mat4.translation(...this.center.times(-1)).times(
        location_matrix
      )
      this.previous = {
        center: this.center.copy(),
        rotation: this.rotation.copy(),
      }
      // drawn_location gets replaced with an interpolated quantity:
      this.drawn_location = location_matrix
      this.temp_matrix = Mat4.identity()
      return Object.assign(this, { linear_velocity, angular_velocity, spin_axis })
    }
  
    check_if_colliding(b, collider) {
      // check_if_colliding(): Collision detection function.
      // DISCLAIMER:  The collision method shown below is not used by anyone; it's just very quick
      // to code.  Making every collision body an ellipsoid is kind of a hack, and looping
      // through a list of discrete sphere points to see if the ellipsoids intersect is *really* a
      // hack (there are perfectly good analytic expressions that can test if two ellipsoids
      // intersect without discretizing them into points).
      if (this == b) return false
      // Nothing collides with itself.
      // Convert sphere b to the frame where a is a unit sphere:
      const T = this.inverse.times(b.drawn_location, this.temp_matrix)
  
      const { intersect_test, points, leeway } = collider
      // For each vertex in that b, shift to the coordinate frame of
      // a_inv*b.  Check if in that coordinate frame it penetrates
      // the unit sphere at the origin.  Leave some leeway.
      return points.arrays.position.some((p) =>
        intersect_test(T.times(p.to4(1)).to3(), leeway)
      )
    }
  }
  
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
