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
import shutil

print("Ray Optics Simulation - Python Example")
print("For more information about this package, see the README.md file.")

# Check if Node.js is installed
if not shutil.which("node"):
    print("\nError: Node.js is not installed.")
    print("You can install it from https://nodejs.org/")
    sys.exit(1)

# ========== Example 1: Detector Reading ==========
print("\n=== Example 1: Detector Reading ===")

# Define a scene with a single ray and a detector
scene_with_detector = {
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
json_with_detector = json.dumps(scene_with_detector)

# Run the simulation using Node.js
# Assumes runner.js is in the same directory as this script
print("Running simulation for detector example...")
simulation_process = subprocess.run(
    ["node", "runner.js"],
    input=json_with_detector.encode(),
    capture_output=True
)

# Parse the result
simulation_result = json.loads(simulation_process.stdout)

# Check for simulator errors and warnings
if simulation_result.get('error'):
    print(f"Simulator error: {simulation_result['error']}")

if simulation_result.get('warning'):
    print(f"Simulator warning: {simulation_result['warning']}")

# Display the detector results
print("Detector results:")
detector = simulation_result['detectors'][0]  # Get the first detector
print(f"  Power: {detector['power']}")

print("  Irradiance map:")
for i in range(5):  # Print all 5 bins
    print(f"    Position {detector['binPositions'][i]:.2f}: {detector['irradianceMap'][i]:.6f}")

# ========== Example 2: Image Generation ==========
print("\n=== Example 2: Image Generation ===")

# Check if node-canvas is installed
canvas_check = subprocess.run(
    ["node", "-e", "try{require('canvas');process.exit(0)}catch(e){process.exit(1)}"]
)

if canvas_check.returncode != 0:
    print("To run this example, you need to install node-canvas:")
    print("  npm install canvas")
    sys.exit(0)

# Define a scene with a single ray and a crop box
scene_with_cropbox = {
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
json_with_cropbox = json.dumps(scene_with_cropbox)

# Run the simulation using Node.js
print("Running simulation for image example...")
render_process = subprocess.run(
    ["node", "runner.js"],
    input=json_with_cropbox.encode(),
    capture_output=True
)

# Parse the result
render_result = json.loads(render_process.stdout)

# Check for simulator errors and warnings
if render_result.get('error'):
    print(f"Simulator error: {render_result['error']}")

if render_result.get('warning'):
    print(f"Simulator warning: {render_result['warning']}")

# Get the image data
image_data = render_result['images'][0]['dataUrl'].split(',')[1]
print(f"Received image data (base64 encoded)")

# Save the image to a file
image_path = "ray_optics_simulation.png"
with open(image_path, "wb") as f:
    f.write(base64.b64decode(image_data))
print(f"Image saved to {image_path}")

print("\nExamples completed!")
