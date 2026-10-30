#!/usr/bin/env julia
#=
Ray Optics Simulation - Julia Example

This example shows how to use the Ray Optics Simulation from Julia:
1. Getting detector readings from a simple optical setup
2. Generating an image of a simple optical setup
=#

using JSON
using Base64

println("Ray Optics Simulation - Julia Example")
println("For more information about this package, see the README.md file.")

# Check if Node.js is installed
node_check = try
    run(`node --version`, devnull, devnull)
    true
catch
    false
end

if !node_check
    println("\nError: Node.js is not installed.")
    println("You can install it from https://nodejs.org/")
    exit(1)
end

# ========== Example 1: Detector Reading ==========
println("\n=== Example 1: Detector Reading ===")

# Define a scene with a single ray and a detector
scene_with_detector = Dict(
    "version" => 5,
    "objs" => [
        Dict(
            "type" => "SingleRay",
            "p1" => Dict("x" => 0, "y" => 0),
            "p2" => Dict("x" => 50, "y" => 0)
        ),
        Dict(
            "type" => "Detector",
            "p1" => Dict("x" => 100, "y" => -50),
            "p2" => Dict("x" => 100, "y" => 50),
            "irradMap" => true,
            "binSize" => 20
        )
    ]
)

# Convert the scene to JSON string
json_with_detector = JSON.json(scene_with_detector)

# Run the simulation using Node.js
println("Running simulation for detector example...")
simulation_process = open(`node runner.js`, "r+")
write(simulation_process, json_with_detector)
close(simulation_process.in)
simulation_output = read(simulation_process, String)
close(simulation_process)

# Parse the result
simulation_result = JSON.parse(simulation_output)

# Check for simulator errors and warnings
if simulation_result["error"] !== nothing
    println("Simulator error: $(simulation_result["error"])")
end

if simulation_result["warning"] !== nothing
    println("Simulator warning: $(simulation_result["warning"])")
end

# Display the detector results
println("Detector results:")
detector = simulation_result["detectors"][1]  # Get the first detector
println("  Power: $(detector["power"])")

println("  Irradiance map:")
for i in 1:5  # Print all 5 bins
    println("    Position $(detector["binPositions"][i]): $(detector["irradianceMap"][i])")
end

# ========== Example 2: Image Generation ==========
println("\n=== Example 2: Image Generation ===")

# Check if node-canvas is installed
canvas_check = try
    run(`node -e "try{require('canvas');process.exit(0)}catch(e){process.exit(1)}"`)
    true
catch
    false
end

if !canvas_check
    println("To run this example, you need to install node-canvas:")
    println("  npm install canvas")
    exit(0)
end

# Define a scene with a single ray and a crop box
scene_with_cropbox = Dict(
    "version" => 5,
    "objs" => [
        Dict(
            "type" => "SingleRay",
            "p1" => Dict("x" => 0, "y" => 0),
            "p2" => Dict("x" => 50, "y" => 0)
        ),
        Dict(
            "type" => "CropBox",
            "p1" => Dict("x" => -100, "y" => -100), # Upper left corner
            "p4" => Dict("x" => 100, "y" => 100),   # Lower right corner
            "width" => 500                          # Width of the image
        )
    ]
)

# Convert the scene to JSON string
json_with_cropbox = JSON.json(scene_with_cropbox)

# Run the simulation using Node.js
println("Running simulation for image example...")
render_process = open(`node runner.js`, "r+")
write(render_process, json_with_cropbox)
close(render_process.in)
render_output = read(render_process, String)
close(render_process)

# Parse the result
render_result = JSON.parse(render_output)

# Check for simulator errors and warnings
if render_result["error"] !== nothing
    println("Simulator error: $(render_result["error"])")
end

if render_result["warning"] !== nothing
    println("Simulator warning: $(render_result["warning"])")
end

# Get the image data
image_data = split(render_result["images"][1]["dataUrl"], ",")[2]
println("Received image data (base64 encoded)")

# Save the image to a file
image_path = "ray_optics_simulation.png"
open(image_path, "w") do f
    write(f, base64decode(image_data))
end
println("Image saved to $image_path")

println("\nExamples completed!")
