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
import sys

print("Ray Optics Simulation - Python Example")

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
try:
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
    detector = detector_result['detectors'][0]  # Get the first detector
    print(f"  Power: {detector['power']}")

    print("  Irradiance map:")
    for i in range(5):  # Print all 5 bins
        print(f"    Position {detector['binPositions'][i]:.2f}: {detector['irradianceMap'][i]:.6f}")

except FileNotFoundError:
    print("Error: Could not run the simulation.")
    print("It is likely because Node.js is not installed.")
    print("You can install Node.js from https://nodejs.org/")
    sys.exit(1)

# ========== Example 2: Image Generation ==========
print("\n=== Example 2: Image Generation ===")

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
try:
    image_process = subprocess.run(
        ["node", "runner.js"],
        input=image_input.encode(),
        capture_output=True,
        check=True
    )

    # Parse the result
    image_result = json.loads(image_process.stdout)

    # Get the image data
    image_data = image_result['images'][0]['dataUrl'].split(',')[1]
    print(f"Received image data (base64 encoded)")
    
    # Save the image to a file
    image_path = "ray_optics_simulation.png"
    with open(image_path, "wb") as f:
        f.write(base64.b64decode(image_data))
    print(f"Image saved to {image_path}")

except subprocess.CalledProcessError:
    print("Error: Could not generate the image.")
    print("This is likely because node-canvas is not installed.")
    print("To use image generation, install node-canvas:")
    print("  npm install canvas")

print("\nExamples completed!")
print("For more information about this package, see the README.md file.")
