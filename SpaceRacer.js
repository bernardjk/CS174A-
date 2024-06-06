import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;
export class Body {
  // **Body** can store and update the properties of a 3D body that incrementally
  // moves from its previous place due to velocities.  It conforms to the
  // approach outlined in the "Fix Your Timestep!" blog post by Glenn Fiedler.
  constructor(shape, material, size) {
      Object.assign(this,
          {shape, material, size})
  }

  // (within some margin of distance).
  static intersect_cube(p, margin = 0) {
      return p.every(value => value >= -1 - margin && value <= 1 + margin)
  }

  static intersect_sphere(p, margin = 0) {
      return p.dot(p) < 1 + margin;
  }

  emplace(location_matrix, linear_velocity, angular_velocity, spin_axis = vec3(0, 0, 0).randomized(1).normalized()) {                               // emplace(): assign the body's initial values, or overwrite them.
      this.center = location_matrix.times(vec4(0, 0, 0, 1)).to3();
      this.rotation = Mat4.translation(...this.center.times(-1)).times(location_matrix);
      this.previous = {center: this.center.copy(), rotation: this.rotation.copy()};
      // drawn_location gets replaced with an interpolated quantity:
      this.drawn_location = location_matrix;
      this.temp_matrix = Mat4.identity();
      return Object.assign(this, {linear_velocity, angular_velocity, spin_axis})
  }

  advance(time_amount) {
      // advance(): Perform an integration (the simplistic Forward Euler method) to
      // advance all the linear and angular velocities one time-step forward.
      this.previous = {center: this.center.copy(), rotation: this.rotation.copy()};
      // Apply the velocities scaled proportionally to real time (time_amount):
      // Linear velocity first, then angular:
      this.center = this.center.plus(this.linear_velocity.times(time_amount));
      this.rotation.pre_multiply(Mat4.rotation(time_amount * this.angular_velocity, ...this.spin_axis));
  }

  // The following are our various functions for testing a single point,
  // p, against some analytically-known geometric volume formula

  blend_rotation(alpha) {
      // blend_rotation(): Just naively do a linear blend of the rotations, which looks
      // ok sometimes but otherwise produces shear matrices, a wrong result.

      // TODO:  Replace this function with proper quaternion blending, and perhaps
      // store this.rotation in quaternion form instead for compactness.
      return this.rotation.map((x, i) => vec4(...this.previous.rotation[i]).mix(x, alpha));
  }

  blend_state(alpha) {
      // blend_state(): Compute the final matrix we'll draw using the previous two physical
      // locations the object occupied.  We'll interpolate between these two states as
      // described at the end of the "Fix Your Timestep!" blog post.
      this.drawn_location = Mat4.translation(...this.previous.center.mix(this.center, alpha))
          .times(this.blend_rotation(alpha))
          .times(Mat4.scale(...this.size));
  }

  check_if_colliding(b, collider) {
      // check_if_colliding(): Collision detection function.
      // DISCLAIMER:  The collision method shown below is not used by anyone; it's just very quick
      // to code.  Making every collision body an ellipsoid is kind of a hack, and looping
      // through a list of discrete sphere points to see if the ellipsoids intersect is *really* a
      // hack (there are perfectly good analytic expressions that can test if two ellipsoids
      // intersect without discretizing them into points).
      if (this == b)
          return false;
      // Nothing collides with itself.
      // Convert sphere b to the frame where a is a unit sphere:
      const T = this.inverse.times(b.drawn_location, this.temp_matrix);

      const {intersect_test, points, leeway} = collider;
      // For each vertex in that b, shift to the coordinate frame of
      // a_inv*b.  Check if in that coordinate frame it penetrates
      // the unit sphere at the origin.  Leave some leeway.
      return points.arrays.position.some(p =>
          intersect_test(T.times(p.to4(1)).to3(), leeway));
  }
}
export class Shape_From_File extends Shape {
    // **Shape_From_File** is a versatile standalone Shape that imports
    // all its arrays' data from an .obj 3D model file.
    constructor(filename) {
        super('position', 'normal', 'texture_coord')
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file(filename)
    }

    load_file(filename) {
        // Request the external file and wait for it to load.
        // Failure mode:  Loads an empty shape.
        return fetch(filename)
            .then((response) => {
                if (response.ok) return Promise.resolve(response.text())
                else return Promise.reject(response.status)
            })
            .then((obj_file_contents) => this.parse_into_mesh(obj_file_contents))
            .catch((error) => {
                this.copy_onto_graphics_card(this.gl)
            })
    }

    parse_into_mesh(data) {
        // Adapted from the "webgl-obj-loader.js" library found online:
        var verts = [],
            vertNormals = [],
            textures = [],
            unpacked = {}

        unpacked.verts = []
        unpacked.norms = []
        unpacked.textures = []
        unpacked.hashindices = {}
        unpacked.indices = []
        unpacked.index = 0

        var lines = data.split('\n')

        var VERTEX_RE = /^v\s/
        var NORMAL_RE = /^vn\s/
        var TEXTURE_RE = /^vt\s/
        var FACE_RE = /^f\s/
        var WHITESPACE_RE = /\s+/

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim()
            var elements = line.split(WHITESPACE_RE)
            elements.shift()

            if (VERTEX_RE.test(line)) verts.push.apply(verts, elements)
            else if (NORMAL_RE.test(line))
                vertNormals.push.apply(vertNormals, elements)
            else if (TEXTURE_RE.test(line)) textures.push.apply(textures, elements)
            else if (FACE_RE.test(line)) {
                var quad = false
                for (var j = 0, eleLen = elements.length; j < eleLen; j++) {
                    if (j === 3 && !quad) {
                        j = 2
                        quad = true
                    }
                    if (elements[j] in unpacked.hashindices)
                        unpacked.indices.push(unpacked.hashindices[elements[j]])
                    else {
                        var vertex = elements[j].split('/')

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0])
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1])
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2])

                        if (textures.length) {
                            unpacked.textures.push(
                                +textures[(vertex[1] - 1 || vertex[0]) * 2 + 0]
                            )
                            unpacked.textures.push(
                                +textures[(vertex[1] - 1 || vertex[0]) * 2 + 1]
                            )
                        }

                        unpacked.norms.push(
                            +vertNormals[(vertex[2] - 1 || vertex[0]) * 3 + 0]
                        )
                        unpacked.norms.push(
                            +vertNormals[(vertex[2] - 1 || vertex[0]) * 3 + 1]
                        )
                        unpacked.norms.push(
                            +vertNormals[(vertex[2] - 1 || vertex[0]) * 3 + 2]
                        )

                        unpacked.hashindices[elements[j]] = unpacked.index
                        unpacked.indices.push(unpacked.index)
                        unpacked.index += 1
                    }
                    if (j === 3 && quad)
                        unpacked.indices.push(unpacked.hashindices[elements[0]])
                }
            }
        }
        {
            const { verts, norms, textures } = unpacked
            for (var j = 0; j < verts.length / 3; j++) {
                this.arrays.position.push(
                    vec3(verts[3 * j], verts[3 * j + 1], verts[3 * j + 2])
                )
                this.arrays.normal.push(
                    vec3(norms[3 * j], norms[3 * j + 1], norms[3 * j + 2])
                )
                this.arrays.texture_coord.push(
                    vec(textures[2 * j], textures[2 * j + 1])
                )
            }
            this.indices = unpacked.indices
        }
        this.normalize_positions(false)
        this.ready = true
    }

    draw(context, program_state, model_transform, material) {
        // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        if (this.ready)
            super.draw(context, program_state, model_transform, material)
    }
}

class Custom_Torus extends Shape {
    constructor(sections, tube_slices, major_radius, minor_radius) {
        super("position", "normal", "texture_coord");

        for (let i = 0; i < sections; i++) {
            const theta = i * 2 * Math.PI / sections;
            const cosTheta = Math.cos(theta);
            const sinTheta = Math.sin(theta);

            for (let j = 0; j < tube_slices; j++) {
                const phi = j * 2 * Math.PI / tube_slices;
                const cosPhi = Math.cos(phi);
                const sinPhi = Math.sin(phi);

                const x = (major_radius + minor_radius * cosPhi) * cosTheta;
                const y = (major_radius + minor_radius * cosPhi) * sinTheta;
                const z = minor_radius * sinPhi;

                this.arrays.position.push(vec3(x, y, z));
                this.arrays.normal.push(vec3(cosPhi * cosTheta, cosPhi * sinTheta, sinPhi));
                this.arrays.texture_coord.push(vec(1 - i / sections, 1 - j / tube_slices));

                const nextI = (i + 1) % sections;
                const nextJ = (j + 1) % tube_slices;

                this.indices.push(i * tube_slices + j, nextI * tube_slices + j, i * tube_slices + nextJ);
                this.indices.push(nextI * tube_slices + j, nextI * tube_slices + nextJ, i * tube_slices + nextJ);
            }
        }
    }
}

export class SpaceRacer extends Scene {
    constructor() {
        super();

        this.shapes = {
            sun: new defs.Subdivision_Sphere(4),
            disk: new Custom_Torus(100, 100, 8, 1),
            black: new defs.Torus(100, 100),
            obstacle: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(2),
            UFO: new Shape_From_File('assets/UFO.obj'),
            car: new defs.Cube(),
            timer: new defs.Subdivision_Sphere(2) // Timer power-up shape
        };

        this.materials = {
            sun: new Material(new defs.Phong_Shader(), {ambient: 1}),
            disk: new Material(new Custom_Sun_Shader(), {ambient: 1, diffusivity: 1, color: hex_color("#9df8f6"), specularity: 1}),
            black: new Material(new defs.Phong_Shader(), {ambient: 0, diffusivity: 0, color: hex_color("#FF0000"), specularity: 0}),
            obstacle: new Material(new defs.Phong_Shader(), {ambient: 1, diffusivity: 1, color: hex_color("#808080"), specularity: 1}),
            UFO: new Material(new defs.Phong_Shader(), {ambient: 1, diffusivity: 1, color: hex_color("#808080"), specularity: 1}),
            car: new Material(new defs.Phong_Shader(), {ambient: 1, diffusivity: 0.5, specularity: 0.5, color: hex_color("#FF0000")}),
            timer: new Material(new defs.Phong_Shader(), {ambient: 1, diffusivity: 1, color: hex_color("#FFD700"), specularity: 1}) // Timer power-up material
        };

        this.initial_camera_location = Mat4.look_at(vec3(0, -150, 150), vec3(0, 0, 0), vec3(0, 1, 0));
        this.colliders = [
          {intersect_test: Body.intersect_sphere, points: new defs.Subdivision_Sphere(1), leeway: .5},
          {intersect_test: Body.intersect_sphere, points: new defs.Subdivision_Sphere(2), leeway: .3},
          {intersect_test: Body.intersect_cube, points: new defs.Cube(), leeway: .1}
      ];
        this.bodies = [];
        this.UFO_transform = Mat4.identity().times(Mat4.translation(8, -4, 2)).times(Mat4.rotation(Math.PI / 2, Math.PI / 2, 0, 0)).times(Mat4.scale(0.5, 0.5, 0.5));
        this.UFO_body = new Body(this.shapes.UFO, this.materials.UFO, vec3(0.2, 0.2, 0.2)).emplace(this.UFO_transform, vec3(0, 0, 0), 0);
        this.key_states = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
        this.velocity = 0;
        this.collided = false; //Flag for collision with asteroids
        this.offTrack = false; //Flag for being off the track
        this.third_person = false;  // Flag for third-person camera mode
        this.angle_of_rotation = 0; // Track the UFO's angle of rotation

        // Timer power-ups
        this.inner_radius = 70; // Inner radius of the ring
        this.outer_radius = 85; // Outer radius of the ring
        this.timer_positions = [];
        this.timer_active = new Array(12).fill(false); // Array to track active power-ups
        this.active_count = 0; // Track the number of active power-ups
        this.generate_timer_positions(); // Generate the positions on the ring
        this.spawn_timer_power_ups(); // Spawn initial power-ups

        // Timer countdown
        this.timer_seconds = 30; // Initialize timer to 30 seconds
        this.last_time = 0; // To keep track of time progression

        // Create a canvas for the timer
        this.timer_canvas = document.createElement('canvas');
        this.timer_canvas.width = 100;
        this.timer_canvas.height = 100;
        this.timer_canvas.style.position = 'absolute';
        this.timer_canvas.style.top = '20px';
        this.timer_canvas.style.right = '148px'; // Move the canvas 20px more to the left
        this.timer_canvas.style.border = '2px solid black'; // Add a black border
        document.body.appendChild(this.timer_canvas);
        this.timer_ctx = this.timer_canvas.getContext('2d');
    }

    generate_timer_positions() {
        const num_powerups = 12;
        const angle_increment = 2 * Math.PI / num_powerups;

        for (let i = 0; i < num_powerups; i++) {
            const angle = i * angle_increment;
            const distance = this.inner_radius + Math.random() * (this.outer_radius - this.inner_radius);
            const x = distance * Math.cos(angle);
            const y = distance * Math.sin(angle);
            this.timer_positions.push(vec3(x, y, 2)); // Assuming z = 0 for simplicity
        }
    }

    spawn_timer_power_ups() {
        while (this.active_count < 3) {
            const index = Math.floor(Math.random() * 12); // Ensure index is between 0 and 11
            if (!this.timer_active[index]) {
                this.timer_active[index] = true;
                this.active_count++;
            }
        }
    }

    check_collisions(UFO_pos) {
        const collision_threshold = 1; // Adjust this value as needed for collision sensitivity

        for (let i = 0; i < this.timer_positions.length; i++) {
            if (this.timer_active[i]) {
                const timer_pos = this.timer_positions[i];
                const distance = Math.sqrt(
                    (UFO_pos[0] - timer_pos[0]) ** 2 +
                    (UFO_pos[1] - timer_pos[1]) ** 2 +
                    (UFO_pos[2] - timer_pos[2]) ** 2
                );

                if (distance < collision_threshold) {
                    console.log(`Collision detected with timer power-up at index ${i}`);
                    this.timer_active[i] = false; // Deactivate the power-up
                    this.active_count--; // Decrement the active count
                    this.spawn_timer_power_ups(); // Ensure there are always 3 active power-ups
                    this.timer_seconds += 5; // Increment the timer by 5 seconds
                }
            }
        }
    }
    check_offTrack(UFO_pos){
        const inner_radius = 58;
        const outer_radius = 90;
        let distance = Math.sqrt(UFO_pos[0]**2 + UFO_pos[1]**2);
        console.log(distance);
        if(distance < 58 || distance > 90){
            return false;
        }
        return true;
    }

    make_control_panel() {
        this.key_triggered_button("Move Forward", ["ArrowUp"], () => this.key_states.ArrowUp = true, undefined, () => this.key_states.ArrowUp = false);
        this.key_triggered_button("Move Backward", ["ArrowDown"], () => this.key_states.ArrowDown = true, undefined, () => this.key_states.ArrowDown = false);
        this.key_triggered_button("Turn Left", ["ArrowLeft"], () => this.key_states.ArrowLeft = true, undefined, () => this.key_states.ArrowLeft = false);
        this.key_triggered_button("Turn Right", ["ArrowRight"], () => this.key_states.ArrowRight = true, undefined, () => this.key_states.ArrowRight = false);
        this.key_triggered_button("Toggle Camera", ["c"], () => this.third_person = !this.third_person);  // Camera toggle button
    }

    getRandomInt(max) {
        return Math.floor(Math.random() * max);
    }

    generate_obstacles(context, program_state, number) {
        let obs_transform = Mat4.identity();
        obs_transform = obs_transform.times(Mat4.translation(7.5, 7.5, 0));
        this.bodies.push(new Body(this.shapes.obstacle, this.materials.obstacle, vec3(0, 0, 0)).emplace(obs_transform, vec3(0, 0, 0), 0));
        this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
        obs_transform = obs_transform.times(Mat4.translation(-9, 1, 0));
        this.bodies.push(new Body(this.shapes.obstacle, this.materials.obstacle, vec3(0, 0, 0)).emplace(obs_transform, vec3(0, 0, 0), 0));
        this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
        obs_transform = obs_transform.times(Mat4.translation(-6, -3, 0));
        this.bodies.push(new Body(this.shapes.obstacle, this.materials.obstacle, vec3(0, 0, 0)).emplace(obs_transform, vec3(0, 0, 0), 0));
        this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
        obs_transform = obs_transform.times(Mat4.translation(0, -5, 0));
        this.bodies.push(new Body(this.shapes.obstacle, this.materials.obstacle, vec3(0, 0, 0)).emplace(obs_transform, vec3(0, 0, 0), 0));
        this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
        obs_transform = obs_transform.times(Mat4.translation(-2, -5, 0));
        this.bodies.push(new Body(this.shapes.obstacle, this.materials.obstacle, vec3(0, 0, 0)).emplace(obs_transform, vec3(0, 0, 0), 0));
        this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
        obs_transform = obs_transform.times(Mat4.translation(5, -6, 0));
        this.bodies.push(new Body(this.shapes.obstacle, this.materials.obstacle, vec3(0, 0, 0)).emplace(obs_transform, vec3(0, 0, 0), 0));
        this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
        obs_transform = obs_transform.times(Mat4.translation(5, 0, 0));
        this.bodies.push(new Body(this.shapes.obstacle, this.materials.obstacle, vec3(0, 0, 0)).emplace(obs_transform, vec3(0, 0, 0), 0));

        this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
        obs_transform = obs_transform.times(Mat4.translation(3, 5, 0));
        this.bodies.push(new Body(this.shapes.obstacle, this.materials.obstacle, vec3(0, 0, 0)).emplace(obs_transform, vec3(0, 0, 0), 0));

        this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
        obs_transform = obs_transform.times(Mat4.translation(6, 5, 0));
        this.bodies.push(new Body(this.shapes.obstacle, this.materials.obstacle, vec3(0, 0, 0)).emplace(obs_transform, vec3(0, 0, 0), 0));

        this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
    }

    display(context, program_state) {
        const pi = Math.PI;
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, .1, 1000);

        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
        let model_transform = Mat4.identity();
        let sun_transform = model_transform;

        var sun_radius = 45;
        sun_transform = sun_transform.times(Mat4.scale(sun_radius, sun_radius, sun_radius));
        var sun_color = color(1, 0.95, 0, 1);

        let disk_transform = model_transform;
        disk_transform = disk_transform.times(Mat4.scale(10, 10, 0.5));

        const acceleration = 0.0125;
        const deceleration = 0.0125;
        const max_speed = 1.5; // Maybe have different max speeds for different level difficulties

        // Update car transformation based on key states
        if (this.key_states.ArrowUp) {
            this.velocity = Math.min(max_speed, this.velocity + acceleration);
        } else if (this.key_states.ArrowDown) {
            this.velocity = Math.max(-max_speed, this.velocity - acceleration);
        } else {
            if (this.velocity > 0) {
                this.velocity = Math.max(0, this.velocity - deceleration);
            } else if (this.velocity < 0) {
                this.velocity = Math.min(0, this.velocity + deceleration);
            }
        }

        // Move the car
        const angle_to_rotate = 0.075;
        if (this.velocity !== 0) {
            this.UFO_transform.post_multiply(Mat4.translation(0, 0, -this.velocity));
            if (this.key_states.ArrowLeft) {
                this.angle_of_rotation -= angle_to_rotate; // Update angle of rotation
                this.UFO_transform.post_multiply(Mat4.rotation(angle_to_rotate, 0, 1, 0)); // Reduced rotation amount
            }
            if (this.key_states.ArrowRight) {
                this.angle_of_rotation += angle_to_rotate; // Update angle of rotation
                this.UFO_transform.post_multiply(Mat4.rotation(-(angle_to_rotate), 0, 1, 0)); // Reduced rotation amount
            }
        }

        const light_position = vec4(0, 0, 0, 1);
        program_state.lights = [new Light(light_position, sun_color, 150 ** sun_radius)];
        this.shapes.sun.draw(context, program_state, sun_transform, this.materials.sun.override({color: sun_color}));
        this.shapes.disk.draw(context, program_state, disk_transform, this.materials.disk);

        // Draw the active timer power-ups
        for (let i = 0; i < this.timer_positions.length; i++) {
            if (this.timer_active[i]) {
                const timer_transform = Mat4.translation(...this.timer_positions[i]);
                this.shapes.timer.draw(context, program_state, timer_transform, this.materials.timer);
            }
        }
        //Let the UFO free fall when it's off the track
        // if (this.offTrack){
        //     console.log(Mat4.inverse(this.UFO_transform));
        //     console.log(this.UFO_transform);
        //     this.UFO_transform = this.UFO_transform.post_multiply(Mat4.translation(0, -t/100, 0));
        //     console.log(this.UFO_transform);
        // }
        // Draw the UFO
        this.shapes.UFO.draw(context, program_state, this.UFO_transform, this.materials.UFO);

        //Check if UFO collides with asteroids
        // this.UFO_body.inverse = Mat4.inverse(this.UFO_body.drawn_location); //Cache the matrix for performance improvement
        // for (let a of this.bodies){
        //   if(this.UFO_body.check_if_colliding(a, this.colliders[0])){
        //     console.log("collided");
        //     this.collided = true;
        //   };
        // }

        // Check for collisions
        const UFO_pos = this.UFO_transform.times(vec4(0, 0, 0, 1)).to3();
        this.check_collisions(UFO_pos);

        //Check if UFO is off the track
        if(!this.check_offTrack(UFO_pos)){
            console.log("falling off");
            this.offTrack = true;
        }
        // Update the timer
        if (this.last_time === 0) {
            this.last_time = t;
        }
        if (t - this.last_time >= 1) {
            this.timer_seconds--;
            this.last_time = t;
        }

        // Display the timer on the canvas
        this.timer_ctx.clearRect(0, 0, this.timer_canvas.width, this.timer_canvas.height);
        this.timer_ctx.fillStyle = "white";
        this.timer_ctx.fillRect(0, 0, this.timer_canvas.width, this.timer_canvas.height);
        this.timer_ctx.font = "30px Arial";
        this.timer_ctx.fillStyle = "red";
        this.timer_ctx.fillText(this.timer_seconds.toString(), 32, 60);

        // Camera logic for third-person perspective
        if (this.third_person) {
            const angle_radians = this.angle_of_rotation;
            const facing_direction = vec3(Math.sin(angle_radians), Math.cos(angle_radians), 0);
            const up_direction = vec3(0, 0, 1); // Up is along the z-axis in this plane
            const camera_distance = 10; // Distance behind the UFO
            const camera_height = 2.5;    // Height above the UFO

            const camera_position = vec3(
                UFO_pos[0] - camera_distance * facing_direction[0],
                UFO_pos[1] - camera_distance * facing_direction[1],
                UFO_pos[2] + camera_height
            );

            const desired_camera_matrix = Mat4.look_at(camera_position, UFO_pos.plus(facing_direction), up_direction);
            program_state.set_camera(desired_camera_matrix);
        } else {
            program_state.set_camera(this.initial_camera_location);
        }
    }
}


class Custom_Sun_Shader extends Shader {
    update_GPU(context, gpu_addresses, program_state, model_transform, material) {
        const [P, C, M] = [program_state.projection_transform, program_state.camera_inverse, model_transform],
            PCM = P.times(C).times(M);
        context.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));
        context.uniformMatrix4fv(gpu_addresses.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));

        // Update uniform values for time, resolution, and mouse if needed
        const u_time = program_state.animation_time / 1000;
        context.uniform1f(gpu_addresses.u_time, u_time);
        context.uniform2f(gpu_addresses.u_resolution, context.canvas.width, context.canvas.height);
        // You can pass mouse coordinates if needed
        context.uniform2f(gpu_addresses.u_mouse, 0, 0); // Replace with actual mouse coordinates if needed
    }

    shared_glsl_code() {
        return `
            precision mediump float;
            varying vec2 v_uv;
        `;
    }

    vertex_glsl_code() {
        return this.shared_glsl_code() + `
            attribute vec3 position;
            attribute vec2 texture_coord;
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
            void main() {
                gl_Position = projection_camera_model_transform * vec4(position, 1.0);
                v_uv = texture_coord;
            }
        `;
    }

    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;
            void main() {
                vec2 coord = gl_FragCoord.xy / u_resolution;
                vec3 color = vec3(0.0);
                vec2 translate = vec2(-0.5);
                coord += translate;

                color.r += abs(0.1 + length(coord) - 0.6 * abs(sin(u_time * 0.9 / 12.0)));
                color.g += abs(0.1 + length(coord) - 0.6 * abs(sin(u_time * 0.6 / 4.0)));
                color.b += abs(0.1 + length(coord) - 0.6 * abs(sin(u_time * 0.3 / 9.0)));

                gl_FragColor = vec4(0.1 / color, 1.0);
            }
        `;
    }
}
