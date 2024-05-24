import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

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

export class SpaceRacer extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            sun: new defs.Subdivision_Sphere(4),
            disk: new defs.Torus(100, 100),
            black: new defs.Torus(100, 100),
            obstacle: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(2),
            UFO: new Shape_From_File('assets/UFO.obj'),
            
        };

        // *** Materials
        this.materials = {
            sun: new Material(new defs.Phong_Shader(),
            {ambient: 1}),
            disk: new Material(new defs.Phong_Shader(),
            {ambient: 1, diffusivity: 1, color: hex_color("#9df8f6"),specularity: 1}),
            black: new Material(new defs.Phong_Shader(),
            {ambient: 0, diffusivity: 0, color: hex_color("#FF0000"),specularity: 0}),
            obstacle: new Material(new defs.Phong_Shader(),
            {ambient: 1, diffusivity: 1, color: hex_color("#808080"), specularity: 1}),
            UFO: new Material(new defs.Phong_Shader(),
            {ambient: 1, diffusivity: 1,color: hex_color("#808080"), specularity: 1}),
            
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
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
        const pi = Math.PI
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        // TODO: Create Planets (Requirement 1)
        // this.shapes.[XXX].draw([XXX]) // <--example
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);
        

        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
        let model_transform = Mat4.identity();
        let sun_transform = model_transform;
        
        var sun_radius = 3;
        sun_transform = sun_transform.times(Mat4.scale(sun_radius, sun_radius, sun_radius));
        // let r = Math.sin(Math.PI * t) * 127 + 128;
        // let g = Math.sin(Math.PI * t + 2 * Math.PI / 3) * 127 + 128;
        // let b = Math.sin(Math.PI * t + 2 * Math.PI * 2 / 3) * 127 + 128;
        var sun_color = color(1, 1, 1, 1);

        let disk_transform = model_transform;

        disk_transform = disk_transform.times(Mat4.scale(23, 23, 1)); 

        let black_transform = model_transform;

        black_transform = model_transform.times(Mat4.scale(28, 28, 1.3)); 
        
        // let UFO_transform = model_transform;

        // // UFO_transform = UFO_transform.times(Mat4.scale(0.5,0.5,0.5))
        // //                             .times(Mat4.translation(15,0, 0).times(Mat4.rotation(pi/2, 0, 1, 0)));

        // UFO_transform = UFO_transform.times(Mat4.rotation(Math.PI / 2, 0, 1, 0));


        const light_position = vec4(0, 0, 0, 1);
        program_state.lights = [new Light(light_position, sun_color, 150 ** sun_radius)];
        this.shapes.sun.draw(context, program_state, sun_transform, this.materials.sun.override({color: sun_color}));
        this.shapes.disk.draw(context, program_state, disk_transform, this.materials.disk);
        this.shapes.black.draw(context, program_state, black_transform, this.materials.black);
        this.generate_obstacles(context,program_state,5);
        // this.shapes.UFO.draw(context, program_state, UFO_transform, this.materials.UFO);
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

        // Specifier "varying" means a variable's final value will be passed from the vertex shader
        // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
        // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
        varying vec3 N, vertex_worldspace;
        varying vec4 vertex_color;

        // ***** PHONG SHADING HAPPENS HERE: *****                                       
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ){                                        
            // phong_model_lights():  Add up the lights' contributions.
            vec3 E = normalize( camera_center - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++){
                // Lights store homogeneous coords - either a position or vector.  If w is 0, the 
                // light will appear directional (uniform direction from all points), and we 
                // simply obtain a vector towards the light by directly using the stored value.
                // Otherwise if w is 1 it will appear as a point light -- compute the vector to 
                // the point light's location from the current surface point.  In either case, 
                // fade (attenuate) the light as the vector needed to reach it gets longer.  
                vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz - 
                                               light_positions_or_vectors[i].w * vertex_worldspace;                                             
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );
                // Compute the diffuse and specular components from the Phong
                // Reflection Model, using Blinn's "halfway vector" method:
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
                float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );
                
                vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                          + light_colors[i].xyz * specularity * specular;
                result += attenuation * light_contribution;
            }
            return result;
        } `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
            attribute vec3 position, normal;                            
            // Position is expressed in object coordinates.
            
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
    
            void main(){                                                                   
                // The vertex's final resting place (in NDCS):
                gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                // The final normal vector in screen space.
                N = normalize( mat3( model_transform ) * normal / squared_scale);
                vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                vertex_color = vec4(shape_color.xyz * ambient, shape_color.w);
                vertex_color.xyz += phong_model_lights(N, vertex_worldspace);

            } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
            void main(){                                                           
                // // Compute an initial (ambient) color:
                // gl_FragColor = vec4( shape_color.xyz * ambient, shape_color.w );
                // // Compute the final color with contributions from lights:
                // gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
                gl_FragColor = vertex_color;
            } `;
    }

    send_material(gl, gpu, material) {
        // send_material(): Send the desired shape-wide material qualities to the
        // graphics card, where they will tweak the Phong lighting formula.
        gl.uniform4fv(gpu.shape_color, material.color);
        gl.uniform1f(gpu.ambient, material.ambient);
        gl.uniform1f(gpu.diffusivity, material.diffusivity);
        gl.uniform1f(gpu.specularity, material.specularity);
        gl.uniform1f(gpu.smoothness, material.smoothness);
    }

    send_gpu_state(gl, gpu, gpu_state, model_transform) {
        // send_gpu_state():  Send the state of our whole drawing context to the GPU.
        const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
        gl.uniform3fv(gpu.camera_center, camera_center);
        // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
        const squared_scale = model_transform.reduce(
            (acc, r) => {
                return acc.plus(vec4(...r).times_pairwise(r))
            }, vec4(0, 0, 0, 0)).to3();
        gl.uniform3fv(gpu.squared_scale, squared_scale);
        // Send the current matrices to the shader.  Go ahead and pre-compute
        // the products we'll need of the of the three special matrices and just
        // cache and send those.  They will be the same throughout this draw
        // call, and thus across each instance of the vertex shader.
        // Transpose them since the GPU expects matrices as column-major arrays.
        const PCM = gpu_state.projection_transform.times(gpu_state.camera_inverse).times(model_transform);
        gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));

        // Omitting lights will show only the material color, scaled by the ambient term:
        if (!gpu_state.lights.length)
            return;

        const light_positions_flattened = [], light_colors_flattened = [];
        for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
            light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
            light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
        }
        gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
        gl.uniform4fv(gpu.light_colors, light_colors_flattened);
        gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
    }

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
        // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
        // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
        // program (which we call the "Program_State").  Send both a material and a program state to the shaders
        // within this function, one data field at a time, to fully initialize the shader for a draw.

        // Fill in any missing fields in the Material object with custom defaults for this shader:
        const defaults = {color: color(0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
        material = Object.assign({}, defaults, material);

        this.send_material(context, gpu_addresses, material);
        this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
    }
}

class Ring_Shader extends Shader {
    update_GPU(context, gpu_addresses, graphics_state, model_transform, material) {
        // update_GPU():  Defining how to synchronize our JavaScript's variables to the GPU's:
        const [P, C, M] = [graphics_state.projection_transform, graphics_state.camera_inverse, model_transform],
            PCM = P.times(C).times(M);
        context.uniformMatrix4fv(gpu_addresses.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        context.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false,
            Matrix.flatten_2D_to_1D(PCM.transposed()));
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return `
        precision mediump float;
        varying vec4 point_position;
        varying vec4 center;
        `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        // TODO:  Complete the main function of the vertex shader (Extra Credit Part II).
        return this.shared_glsl_code() + `
        attribute vec3 position;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;
        
        void main(){
            center = model_transform * vec4(0,0,0,1);
            point_position = model_transform * vec4(position, 1);
            gl_Position = projection_camera_model_transform * vec4(position, 1); 
        }`;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // TODO:  Complete the main function of the fragment shader (Extra Credit Part II).
        return this.shared_glsl_code() + `
        void main(){
            float scalar = sin(15.0 * distance(point_position.xyz, center.xyz));
            gl_FragColor = scalar * vec4(0.6, 0.4, 0.1, 1);
        }`;
    }
}



