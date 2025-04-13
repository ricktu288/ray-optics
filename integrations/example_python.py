#!/usr/bin/env python3
"""
Ray Optics Simulation - Python Example

This example shows how to use the Ray Optics Simulation from Python:
1. Getting detector readings from a simple optical setup
2. Generating an image of a simple optical setup
"""

import json
import subprocess
import base64

print("Ray Optics Simulation - Python Example")
print("For more information, see the README.md file.")

# ========== Example 1: Detector Reading ==========
print("\n=== Example 1: Detector Reading ===")

# Define a scene with a single ray and a detector
detector_scene = {
    "version": 5,
    "objs": [
        {
            "type": "SingleRay",
            "p1": {"x": 0, "y": 0},
            "p2": {"x": 50, "y": 0}
        },
        {
            "type": "Detector",
            "p1": {"x": 100, "y": -50},
            "p2": {"x": 100, "y": 50},
            "irradMap": True,
            "binSize": 20
        }
    ]
}

# Convert the scene to JSON string
detector_input = json.dumps(detector_scene)

# Run the simulation using Node.js
# Assumes runner.js is in the same directory as this script
print("Running simulation for detector example...")
detector_process = subprocess.run(
    ["node", "runner.js"],
    input=detector_input.encode(),
    capture_output=True,
    check=True
)

# Parse the result
detector_result = json.loads(detector_process.stdout)

# Display the detector results
print("Detector results:")
if 'detectors' in detector_result:
    detector = detector_result['detectors'][0]  # Get the first detector
    print(f"  Power: {detector['power']}")

    print("  Irradiance map:")
    for i in range(5):  # Print all 5 bins
        print(f"    Position {detector['binPositions'][i]:.2f}: {detector['irradianceMap'][i]:.6f}")
else:
    print("  No detector data found in the result")


# ========== Example 2: Image Generation ==========
print("\n=== Example 2: Image Generation ===")
print("Note: This example requires node-canvas to be installed.")

# Define a scene with a single ray and a crop box
image_scene = {
    "version": 5,
    "objs": [
        {
            "type": "SingleRay",
            "p1": {"x": 0, "y": 0},
            "p2": {"x": 50, "y": 0}
        },
        {
            "type": "CropBox",
            "p1": {"x": -100, "y": -100}, # Upper left corner
            "p4": {"x": 100, "y": 100},   # Lower right corner
            "width": 500                  # Width of the image
        }
    ]
}

# Convert the scene to JSON string
image_input = json.dumps(image_scene)

# Run the simulation using Node.js
print("Running simulation for image example...")
image_process = subprocess.run(
    ["node", "runner.js"],
    input=image_input.encode(),
    capture_output=True
)

# Parse the result
image_result = json.loads(image_process.stdout)

# Check if image is available
if 'images' in image_result and len(image_result['images']) > 0:
    # The image is returned as a base64-encoded data URL
    image_data = image_result['images'][0]['dataUrl'].split(',')[1]
    print(f"Received image data (base64 encoded)")
    
    # Save the image to a file
    image_path = "ray_optics_simulation.png"
    with open(image_path, "wb") as f:
        f.write(base64.b64decode(image_data))
    print(f"Image saved to {image_path}")
else:
    # No image found, treat as error
    print("Error: No image data found in the result")
    print("This is likely because node-canvas is not installed")
    print("To use image generation, install node-canvas:")
    print("  npm install canvas")

print("\nExamples completed!")
