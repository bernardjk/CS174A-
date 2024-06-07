import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

export class Text_Line extends Shape {                           // **Text_Line** embeds text in the 3D world, using a crude texture
    // method.  This Shape is made of a horizontal arrangement of quads.
    // Each is textured over with images of ASCII characters, spelling
    // out a string.  Usage:  Instantiate the Shape with the desired
    // character line width.  Then assign it a single-line string by calling
    // set_string("your string") on it. Draw the shape on a material
    // with full ambient weight, and text.png assigned as its texture
    // file.  For multi-line strings, repeat this process and draw with
    // a different matrix.
constructor(max_size) {
super("position", "normal", "texture_coord");
this.max_size = max_size;
var object_transform = Mat4.identity();
for (var i = 0; i < max_size; i++) {                                       // Each quad is a separate Square instance:
defs.Square.insert_transformed_copy_into(this, [], object_transform);
object_transform.post_multiply(Mat4.translation(1.5, 0, 0));
}
}

set_string(line, context) {           // set_string():  Call this to overwrite the texture coordinates buffer with new
// values per quad, which enclose each of the string's characters.
this.arrays.texture_coord = [];
for (var i = 0; i < this.max_size; i++) {
var row = Math.floor((i < line.length ? line.charCodeAt(i) : ' '.charCodeAt()) / 16),
col = Math.floor((i < line.length ? line.charCodeAt(i) : ' '.charCodeAt()) % 16);

var skip = 3, size = 32, sizefloor = size - skip;
var dim = size * 16,
left = (col * size + skip) / dim, top = (row * size + skip) / dim,
right = (col * size + sizefloor) / dim, bottom = (row * size + sizefloor + 5) / dim;

this.arrays.texture_coord.push(...Vector.cast([left, 1 - bottom], [right, 1 - bottom],
[left, 1 - top], [right, 1 - top]));
}
if (!this.existing) {
this.copy_onto_graphics_card(context);
this.existing = true;
} else
this.copy_onto_graphics_card(context, ["texture_coord"], false);
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
            disk: new Custom_Torus(100, 100, 8, 2),
            black: new defs.Torus(100, 100),
            obstacle: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(2),
            UFO: new Shape_From_File('assets/UFO.obj'),
            car: new defs.Cube(),
            timer: new defs.Subdivision_Sphere(2), // Timer power-up shape
            coin: new Shape_From_File('assets/Coin.obj'), // Coin shape
            text: new Text_Line(35)

        };

        this.materials = {
            sun: new Material(new Custom_Sun_Shader(), {ambient: 1}),
            disk: new Material(new Custom_Ring_Shader(), {ambient: 1, diffusivity: 1, color: hex_color("#9df8f6"), specularity: 1}),
            black: new Material(new defs.Phong_Shader(), {ambient: 0, diffusivity: 0, color: hex_color("#FF0000"), specularity: 0}),
            obstacle: new Material(new defs.Phong_Shader(), {ambient: 1, diffusivity: 1, color: hex_color("#808080"), specularity: 1}),
            UFO: new Material(new defs.Phong_Shader(), {ambient: 1, diffusivity: 1, color: hex_color("#808080"), specularity: 1}),
            car: new Material(new defs.Phong_Shader(), {ambient: 1, diffusivity: 0.5, specularity: 0.5, color: hex_color("#FF0000")}),
            timer: new Material(new defs.Phong_Shader(), {ambient: 1, diffusivity: 1, color: hex_color("#800080"), specularity: 1}), // Timer power-up material
            coin: new Material(new defs.Phong_Shader(), {ambient: 1, diffusivity: 0, color: hex_color("#FFD700"), specularity: 1}), // Coin material
            start_text: new Material(new defs.Textured_Phong(1), {color: color(0, 0, 255, 1), ambient: 0.5, diffusivity: 0.1, specularity: 0.1, texture: new Texture('assets/text.png'),})

        };

        this.initial_camera_location = Mat4.look_at(vec3(0, 0, 150), vec3(0, 0, 0), vec3(0, 1, 0));

        this.UFO_transform = Mat4.identity().times(Mat4.translation(80, 0, 2)).times(Mat4.rotation(Math.PI / 2, Math.PI / 2, 0, 0)).times(Mat4.scale(0.5, 0.5, 0.5));
        this.key_states = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
        this.velocity = 0;
        this.collided_count = 0; //Keep track of number of collisions
        this.offTrack = false; //Flag for being off the track
        this.prev_offTrack_value = this.offTrack;
        this.curr_offTrack_value = this.offTrack;
        this.third_person = false;  // Flag for third-person camera mode
        this.angle_of_rotation = 0; // Track the UFO's angle of rotation
        this.frozen = false;
        this.frozen_camera = Mat4.look_at(vec3(0, 0, 150), vec3(0, 0, 0), vec3(0, 1, 0));
        this.score = 0;
        // Timer power-ups
        this.inner_radius = 70; // Inner radius of the ring
        this.outer_radius = 85; // Outer radius of the ring
        this.timer_positions = [];
        this.timer_active = new Array(12).fill(false); // Array to track active power-ups
        this.active_count = 0; // Track the number of active power-ups
        this.generate_timer_positions(); // Generate the positions on the ring
        this.spawn_timer_power_ups(); // Spawn initial power-ups
        this.num_obs = 30;

        // Coins
        this.coin_positions = [];
        this.coin_active = new Array(18).fill(false); // Array to track active coins
        this.coin_count = 0;
        this.generate_coin_positions(); // Generate the positions on the ring
        this.spawn_coins();
        this.max_speed = 1.0;
        this.acceleration = 0.02;
        this.deceleration = 0.02;

        // Timer countdown
        this.timer_seconds = 15; // Initialize timer to 30 seconds
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
         //Create a canvas for score
         this.score_canvas = document.createElement('canvas');
         this.score_canvas.width = 100;
         this.score_canvas.height = 100;
         this.score_canvas.style.position = 'absolute';
         this.score_canvas.style.top = '20px';
         this.score_canvas.style.left = '148px'; // Move the canvas 20px more to the left
         this.score_canvas.style.border = '2px solid black'; // Add a black border
         document.body.appendChild(this.score_canvas);
         this.score_ctx = this.score_canvas.getContext('2d');
        this.obstacles = [];
        this.generate_obs_positions();
       
        
    }

    generate_obs_positions() {
        const angle_increment = 2 * Math.PI / this.num_obs;
        for (let i = 0; i < this.num_obs; i++) {
            const angle = i * angle_increment + this.getRandomNumber(5, 20);
            const distance = this.inner_radius + Math.random() * (this.outer_radius - this.inner_radius);
            const x = distance * Math.cos(angle);
            const y = distance * Math.sin(angle);
            // Include movement speed and direction (1 for outward, -1 for inward)
            this.obstacles.push({ position: vec3(x, y, 2), speed: Math.random() * 0.05 + 0.1, direction: Math.random() < 0.5 ? 1 : -1 });
        }
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

    generate_coin_positions() {
        const num_coins = 18;
        const angle_increment = 2 * Math.PI / num_coins;

        for (let i = 0; i < num_coins; i++) {
            const angle = i * angle_increment;
            const distance = this.inner_radius + Math.random() * (this.outer_radius - this.inner_radius);
            const x = distance * Math.cos(angle);
            const y = distance * Math.sin(angle);
            this.coin_positions.push(vec3(x, y, 2)); // Assuming z = 0 for simplicity
        }
    }
    spawn_coins(){
        while (this.coin_count < 5) {
            const index = Math.floor(Math.random() * 18); // Ensure index is between 0 and 11
            if (!this.coin_active[index]) {
                this.coin_active[index] = true;
                this.coin_count++;
            }
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
        const collision_threshold = 3; // Adjust this value as needed for collision sensitivity

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
                    this.timer_seconds += 3; // Increment the timer by 5 seconds
                }
            }
        }

        for (let i = 0; i < this.coin_positions.length; i++) {
            if (this.coin_active[i]) {
                const coin_pos = this.coin_positions[i];
                const distance = Math.sqrt(
                    (UFO_pos[0] - coin_pos[0]) ** 2 +
                    (UFO_pos[1] - coin_pos[1]) ** 2 +
                    (UFO_pos[2] - coin_pos[2]) ** 2
                );

                if (distance < collision_threshold) {
                    console.log(`Collision detected with coin at index ${i}`);
                    this.coin_active[i] = false; // Deactivate the coin
                    this.coin_count -= 1;
                    this.max_speed += 0.12; // Increase max speed
                    this.acceleration += 0.0025;
                    this.deceleration += 0.0025;
                    this.score ++;
                    this.spawn_coins();
                }
            }
        }
    }

    check_if_colliding(UFO_pos) {
        // const T = UFO_inverse_transform.times(obstacle_transform);
        // const {intersect_test, points, leeway} = collider;
        // // For each vertex in that b, shift to the coordinate frame of
        // // a_inv*b.  Check if in that coordinate frame it penetrates
        // // the unit sphere at the origin.  Leave some leeway.
        // return points.arrays.position.some(p =>
        //     intersect_test(T.times(p.to4(1)).to3(), leeway));
        const collision_threshold = 3;
        for(let i = 0; i < this.obstacles.length; i++){
            const obs_pos = this.obstacles[i].position;
            const distance = Math.sqrt((UFO_pos[0] - obs_pos[0])**2 +
                (UFO_pos[1] - obs_pos[1])**2 +
                (UFO_pos[2] - obs_pos[2])**2 );
            if(distance < collision_threshold){
                //Reverse the direction of obstacle when collided
                this.obstacles[i].direction = - this.obstacles[i].direction;
                //Reverse direction of UFO when it moves
                if(this.velocity != 0){
                    this.velocity = - this.velocity;
                }
                //When it stay stills, it bounces back a little
                else{
                    this.velocity = - 8*this.obstacles[i].speed;
                }
                //Might use this variable to determine if a player loses
                this.collided_count ++;
            }

        }
    }
    check_offTrack(UFO_pos){
        let distance = Math.sqrt(UFO_pos[0]**2 + UFO_pos[1]**2);
        // console.log(distance);
        if(distance < (this.inner_radius - 10 ) || distance > (this.outer_radius + 15)|| UFO_pos[2] < 0){
            return true;
        }
        return false;
    }


    make_control_panel() {
        this.key_triggered_button("Move Forward", ["ArrowUp"], () => this.key_states.ArrowUp = true, undefined, () => this.key_states.ArrowUp = false);
        this.key_triggered_button("Move Backward", ["ArrowDown"], () => this.key_states.ArrowDown = true, undefined, () => this.key_states.ArrowDown = false);
        this.key_triggered_button("Turn Left", ["ArrowLeft"], () => this.key_states.ArrowLeft = true, undefined, () => this.key_states.ArrowLeft = false);
        this.key_triggered_button("Turn Right", ["ArrowRight"], () => this.key_states.ArrowRight = true, undefined, () => this.key_states.ArrowRight = false);
        this.key_triggered_button("Toggle Camera", ["c"], () => this.third_person = !this.third_person);  // Camera toggle button
    }

    getRandomNumber(min, max) {
        let randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
        let randomSign = Math.random() < 0.5 ? -1 : 1;  // Randomly assigns -1 or 1
        return randomNumber * randomSign;
    }

    display(context, program_state) {
        const pi = Math.PI;
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, .1, 1000);
        let desired_camera_matrix = this.initial_camera_location;
    
        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
        let model_transform = Mat4.identity();
        let sun_transform = model_transform;

        var sun_radius = 45;
        sun_transform = sun_transform.times(Mat4.scale(sun_radius, sun_radius, sun_radius));
        var sun_color = color(1, 0.95, 0, 1);

        let disk_transform = model_transform;
        disk_transform = disk_transform.times(Mat4.scale(10, 10, 0.5));

        // Update car transformation based on key states
        if (this.key_states.ArrowUp && !this.frozen) {
            this.velocity = Math.min(this.max_speed, this.velocity + this.acceleration);
        } else if (this.key_states.ArrowDown && !this.frozen) {
            this.velocity = Math.max(-(this.max_speed), this.velocity - this.acceleration);
        } else {
            if (this.velocity > 0) {
                this.velocity = Math.max(0, this.velocity - this.deceleration);
            } else if (this.velocity < 0) {
                this.velocity = Math.min(0, this.velocity + this.deceleration);
            }
        }

        // Move the car
        const angle_to_rotate = 0.075;
        if (this.velocity !== 0) {
            this.UFO_transform.post_multiply(Mat4.translation(0, 0, -this.velocity));
            if (this.key_states.ArrowLeft && !(this.frozen)) {
                this.angle_of_rotation -= angle_to_rotate; // Update angle of rotation
                this.UFO_transform.post_multiply(Mat4.rotation(angle_to_rotate, 0, 1, 0)); // Reduced rotation amount
            }
            if (this.key_states.ArrowRight && !(this.frozen)) {
                this.angle_of_rotation += angle_to_rotate; // Update angle of rotation
                this.UFO_transform.post_multiply(Mat4.rotation(-(angle_to_rotate), 0, 1, 0)); // Reduced rotation amount
            }
        }

        // Apply self-rotation to the UFO
        let self_rotating_UFO_transform = this.UFO_transform.times(Mat4.rotation(t, 0, 1, 0)); // Rotate around the Y axis

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

        // Draw the active coins
        for (let i = 0; i < this.coin_positions.length; i++) {
            if (this.coin_active[i]) {
                // Apply self-rotation to the coin
                let coin_transform = Mat4.translation(...this.coin_positions[i]);
                coin_transform = coin_transform.times(Mat4.rotation(t, 0, 0, 1)); // Rotate around the Y axis
                this.shapes.coin.draw(context, program_state, coin_transform, this.materials.coin);
            }
        }

        for (let i = 0; i < this.obstacles.length; i++) {
            let angle = Math.atan2(this.obstacles[i].position[1],this.obstacles[i].position[0]);
            let current_distance = Math.sqrt(this.obstacles[i].position[0]**2 +this.obstacles[i].position[1]**2);

            let new_distance = current_distance +this.obstacles[i].direction *this.obstacles[i].speed;
            let o_r = this.outer_radius + 10
            let i_r = this.inner_radius - 10

            // Check boundary conditions with a buffer zone to prevent jitter
            if (new_distance > o_r) {
                new_distance = o_r - 0.1; // Stop slightly before the boundary
                this.obstacles[i].direction = -1; // Reverse direction
            } else if (new_distance < i_r) {
                new_distance = i_r + 0.1; // Stop slightly after the boundary
                this.obstacles[i].direction = 1; // Reverse direction
            }

            this.obstacles[i].position[0] = new_distance * Math.cos(angle);
            this.obstacles[i].position[1] = new_distance * Math.sin(angle);

            // Self-rotation transformation
            let obs_transform = Mat4.translation(...this.obstacles[i].position);
            obs_transform = obs_transform.times(Mat4.rotation(t, 0, 1, 0)); // Rotate around the Y axis

            this.shapes.obstacle.draw(context, program_state, obs_transform, this.materials.obstacle);
        }
        this.shapes.UFO.draw(context, program_state, self_rotating_UFO_transform, this.materials.UFO); // Use self-rotating transform

        // Check for collisions
        const UFO_pos = self_rotating_UFO_transform.times(vec4(0, 0, 0, 1)).to3();
        this.check_collisions(UFO_pos);
        this.check_if_colliding(UFO_pos);

        //Check the value of offTrack variable
        // Update the timer
        if (this.last_time === 0) {
            this.last_time = t;
        }
        if (t - this.last_time >= 1) {
            this.timer_seconds--;
            this.last_time = t;
        }
        if(this.check_offTrack(UFO_pos) || this.timer_seconds <= 0){
            this.UFO_transform = this.UFO_transform.post_multiply(Mat4.translation(0, -0.5, 0));
        }
        this.shapes.text.set_string('Game over!', context.context);
        this.shapes.text.draw(context,program_state,
            this.initial_camera_location.times(Mat4.translation(-105, 10, 1000)).times(Mat4.scale(10, 10, 10)),
            this.materials.start_text);
        this.shapes.text.set_string(`Your score: ${this.score}`, context.context);
        this.shapes.text.draw(context,program_state,
            this.initial_camera_location.times(Mat4.translation(-105, -20, 1000)).times(Mat4.scale(10, 10, 10)),
            this.materials.start_text);
        program_state.set_camera(this.initial_camera_location);
    
        // Display the timer on the canvas
        this.timer_ctx.clearRect(0, 0, this.timer_canvas.width, this.timer_canvas.height);
        this.timer_ctx.fillStyle = "white";
        this.timer_ctx.fillRect(0, 0, this.timer_canvas.width, this.timer_canvas.height);
        this.timer_ctx.font = "30px Arial";
        this.timer_ctx.fillStyle = "red";
        this.timer_ctx.fillText(this.timer_seconds.toString(), 32, 60);
        //Dispay the scoreboard
        this.score_ctx.clearRect(0, 0, this.score_canvas.width, this.score_canvas.height);
        this.score_ctx.fillStyle = "white";
        this.score_ctx.fillRect(0, 0, this.score_canvas.width, this.score_canvas.height);
        this.score_ctx.font = "30px Arial";
        this.score_ctx.fillStyle = "red";
        this.score_ctx.fillText(this.score.toString(), 32, 60);
    
        // Camera logic for third-person and top-down perspective
        if (UFO_pos[2] < -5) {
            desired_camera_matrix = Mat4.look_at(vec3(0, 0, 1100), vec3(0, 0, 0), vec3(0, 1, 0));
            program_state.set_camera(desired_camera_matrix);
        }
        else {
                // Camera logic for third-person and top-down perspective
            const UFO_height = 150; // Fixed height for top-down view
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

                desired_camera_matrix = Mat4.look_at(camera_position, UFO_pos.plus(facing_direction), up_direction);
                program_state.set_camera(desired_camera_matrix);
            } else {
                // Top-down view
                const camera_position = vec3(UFO_pos[0], UFO_pos[1], UFO_height);
                desired_camera_matrix = Mat4.look_at(camera_position, UFO_pos, vec3(0, 1, 0));
                program_state.set_camera(desired_camera_matrix);
            }
        }
    }
}



class Custom_Ring_Shader extends Shader {
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
                vec2 coord = gl_FragCoord.xy  / u_resolution;
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

//centered at origin
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
    }

    shared_glsl_code() {
        return `
            precision mediump float;
            varying vec3 v_position;
        `;
    }

    vertex_glsl_code() {
        return this.shared_glsl_code() + `
            attribute vec3 position;
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
            void main() {
                gl_Position = projection_camera_model_transform * vec4(position, 1.0);
                v_position = (model_transform * vec4(position, 1.0)).xyz;
            }
        `;
    }

    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            uniform float u_time;
            uniform vec2 u_resolution;
            void main() {
                vec2 coord = v_position.xy / u_resolution;
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