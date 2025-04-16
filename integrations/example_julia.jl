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

# ========== Example 1: Detector Reading ==========
println("\n=== Example 1: Detector Reading ===")

# Define a scene with a single ray and a detector
detector_scene = Dict(
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
detector_input = JSON.json(detector_scene)

# Run the simulation using Node.js
println("Running simulation for detector example...")
try
    detector_process = open(`node runner.js`, "r+")
    write(detector_process, detector_input)
    close(detector_process.in)
    detector_output = read(detector_process, String)
    close(detector_process)

    # Parse the result
    detector_result = JSON.parse(detector_output)

    # Display the detector results
    println("Detector results:")
    detector = detector_result["detectors"][1]  # Get the first detector
    println("  Power: $(detector["power"])")

    println("  Irradiance map:")
    for i in 1:5  # Print all 5 bins
        println("    Position $(detector["binPositions"][i]): $(detector["irradianceMap"][i])")
    end
catch e
    println("Error: Could not run the simulation.")
    println("It is likely because Node.js is not installed.")
    println("You can install Node.js from https://nodejs.org/")
    exit(1)
end


# ========== Example 2: Image Generation ==========
println("\n=== Example 2: Image Generation ===")

# Define a scene with a single ray and a crop box
image_scene = Dict(
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
image_input = JSON.json(image_scene)

# Run the simulation using Node.js
println("Running simulation for image example...")
try
    image_process = open(`node runner.js`, "r+")
    write(image_process, image_input)
    close(image_process.in)
    image_output = read(image_process, String)
    close(image_process)

    # Parse the result
    image_result = JSON.parse(image_output)

    # Get the image data
    data_url = image_result["images"][1]["dataUrl"]
    image_data = split(data_url, ",")[2]
    println("Received image data (base64 encoded)")
    
    # Save the image to a file
    image_path = "ray_optics_simulation.png"
    open(image_path, "w") do f
        write(f, base64decode(image_data))
    end
    println("Image saved to $image_path")
catch e
    println("Error: Could not generate the image.")
    println("This is likely because node-canvas is not installed.")
    println("To use image generation, install node-canvas:")
    println("  npm install canvas")
end

println("\nExamples completed!")
println("For more information about this package, see the README.md file.")
