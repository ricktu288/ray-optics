# Module

A module is a collection of optical elements arranged in a specific way, which custom control points and parameters. The module's code is directly embedded in the scene's JSON code.

## Structure

### Module Definition

A module is defined in the `modules` key of the scene's JSON code. It has the following properties:

- `numPoints`: The number of draggable control points, whose coordinates are of the form `x_i` and `y_i`, where `i` starts from 1.
- `params`: An array of parameters (adjustable as sliders), each as a string in the format `name=start:step:end:default`. The default is used when the user creates a module object from the Tools menu.
- `vars`: An array of math.js statements, which define variables or functions.
- `objs`: An array of objects with the template format, where backticks are used to wrap math.js expressions, and objects in arrays has two special properties:
    - `for`: A string in the format `name=start:step:end`, or an array of such strings, which defines an array of objects.
    - `if`: A math.js expression, which defines a condition whether the object should be included.
- `maxLoopLength`: The maximum length of the list in for loops to prevent infinite loops. Defaults to 1000.

### Module Object

A module object is defined in the `objs` key of the scene's JSON code with type `ModuleObj`. It has the following properties:

- `module`: The name of the module.
- `points`: An array of points, each as an object with `x` and `y` properties.
- `params`: An object of parameters, which are the values of the parameters defined in the module.

## Examples

### A beam with exponentially decay intensity profile

```json
{
  "version": 5,
  "modules": {
    "ExpBeam": {
      "numPoints": 2,
      "params": [
        "N=1:1:200:50",
        "dtheta=0.01:0.01:0.5:0.1",
        "A=0.01:0.01:10:5",
        "tau=0.01:0.01:2:0.25"
      ],
      "vars": [
        "dx=(x_2-x_1)/N",
        "dy=(y_2-y_1)/N",
        "L=sqrt((x_2-x_1)^2+(y_2-y_1)^2)",
        "normal=atan2(y_2-y_1,x_2-x_1)-pi/2"
      ],
      "objs": [
        {
          "for": [
            "i=0:1:N-1",
            "theta=-pi/2:dtheta:pi/2"
          ],
          "type": "SingleRay",
          "p1": {
            "x": "`x_1 + dx*i`",
            "y": "`y_1 + dy*i`"
          },
          "p2": {
            "x": "`x_1 + dx*i + cos(normal + theta)`",
            "y": "`y_1 + dy*i + sin(normal + theta)`"
          },
          "brightness": "`A * exp(-abs(theta)/tau) / N`"
        }
      ],
      "maxLoopLength": 10000
    }
  },
  "objs": [
    {
      "type": "ModuleObj",
      "module": "ExpBeam",
      "points": [
        {
          "x": 600,
          "y": 300
        },
        {
          "x": 600,
          "y": 500
        }
      ],
      "params": {
        "N": 50,
        "dtheta": 0.04,
        "A": 5,
        "tau": 0.25
      }
    }
  ]
}
```

### A spiral mirror (with a ray from within)

```json
{
  "version": 5,
  "modules": {
    "SpiralMirror": {
      "numPoints": 1,
      "params": [
        "a=2:0.1:20:5",
        "turns=1:0.1:10:3",
        "segments=10:1:1000:100"
      ],
      "vars": [
        "thetaMax=2*pi*turns",
        "theta(i)=thetaMax*i/segments",
        "r(i)=a*theta(i)",
        "x(i)=x_1 + r(i)*cos(theta(i))",
        "y(i)=y_1 + r(i)*sin(theta(i))"
      ],
      "objs": [
        {
          "for": "i=0:1:segments-1",
          "type": "Mirror",
          "p1": {
            "x": "`x(i)`",
            "y": "`y(i)`"
          },
          "p2": {
            "x": "`x(i+1)`",
            "y": "`y(i+1)`"
          }
        }
      ]
    }
  },
  "objs": [
    {
      "type": "ModuleObj",
      "module": "SpiralMirror",
      "points": [
        {
          "x": 700,
          "y": 450
        }
      ],
      "params": {
        "a": 10,
        "turns": 3,
        "segments": 300
      }
    },
    {
      "type": "SingleRay",
      "p1": {
        "x": 720,
        "y": 460
      },
      "p2": {
        "x": 740,
        "y": 460
      }
    }
  ]
}
```

### A chaff of random linear mirrors (with a source shining through)

```json
{
  "version": 5,
  "name": "Chaff",
  "modules": {
    "ChaffPiece": {
      "numPoints": 0,
      "params": [
        "x=0:1:1000:0",
        "y=0:1:1000:0",
        "theta=0:0.001:2pi:0",
        "L=0.01:0.01:10:5"
      ],
      "objs": [
        {
          "type": "Mirror",
          "p1": {
            "x": "`x`",
            "y": "`y`"
          },
          "p2": {
            "x": "`x+L*cos(theta)`",
            "y": "`y+L*sin(theta)`"
          }
        }
      ]
    },
    "Chaff": {
      "numPoints": 2,
      "params": [
        "N=1:1:10000:10",
        "L=0.01:0.01:10:5"
      ],
      "objs": [
        {
          "for": "i=1:1:N",
          "type": "ModuleObj",
          "module": "ChaffPiece",
          "points": [],
          "params": {
            "x": "`x_1+random()*(x_2-x_1)`",
            "y": "`y_1+random()*(y_2-y_1)`",
            "L": "`L`",
            "theta": "`random()*pi`"
          }
        }
      ],
      "maxLoopLength": 10000
    }
  },
  "objs": [
    {
      "type": "ModuleObj",
      "module": "Chaff",
      "points": [
        {
          "x": 600,
          "y": 300
        },
        {
          "x": 900,
          "y": 600
        }
      ],
      "params": {
        "N": 1000,
        "L": 5
      }
    },
    {
      "type": "Beam",
      "p1": {
        "x": 500,
        "y": 300
      },
      "p2": {
        "x": 500,
        "y": 600
      }
    }
  ]
}
```

### An optical fiber with core, cladding, and jacket

```json
{
  "version": 5,
  "modules": {
    "OpticalFiber": {
      "numPoints": 2,
      "params": [
        "core_thickness=20:1:100:1",
        "cladding_thickness=10:1:100:1",
        "core_n=1.5:0.01:3:0.01",
        "cladding_n=1.4:0.01:3:0.01"
      ],
      "vars": [
        "dx=x_2-x_1",
        "dy=y_2-y_1",
        "len=sqrt(dx^2+dy^2)",
        "nx=-dy/len",
        "ny=dx/len",
        "x_c1=x_1+core_thickness*nx",
        "y_c1=y_1+core_thickness*ny",
        "x_c2=x_2+core_thickness*nx",
        "y_c2=y_2+core_thickness*ny",
        "x_c3=x_2-core_thickness*nx",
        "y_c3=y_2-core_thickness*ny",
        "x_c4=x_1-core_thickness*nx",
        "y_c4=y_1-core_thickness*ny",
        "x_o1=x_1+(core_thickness+cladding_thickness)*nx",
        "y_o1=y_1+(core_thickness+cladding_thickness)*ny",
        "x_o2=x_2+(core_thickness+cladding_thickness)*nx",
        "y_o2=y_2+(core_thickness+cladding_thickness)*ny",
        "x_o3=x_2-(core_thickness+cladding_thickness)*nx",
        "y_o3=y_2-(core_thickness+cladding_thickness)*ny",
        "x_o4=x_1-(core_thickness+cladding_thickness)*nx",
        "y_o4=y_1-(core_thickness+cladding_thickness)*ny",
        "x_b1=x_1+(core_thickness+cladding_thickness+10)*nx",
        "y_b1=y_1+(core_thickness+cladding_thickness+10)*ny",
        "x_b2=x_2+(core_thickness+cladding_thickness+10)*nx",
        "y_b2=y_2+(core_thickness+cladding_thickness+10)*ny",
        "x_b3=x_2-(core_thickness+cladding_thickness+10)*nx",
        "y_b3=y_2-(core_thickness+cladding_thickness+10)*ny",
        "x_b4=x_1-(core_thickness+cladding_thickness+10)*nx",
        "y_b4=y_1-(core_thickness+cladding_thickness+10)*ny"
      ],
      "objs": [
        {
          "type": "Glass",
          "path": [
            {
              "x": "`x_c1`",
              "y": "`y_c1`",
              "arc": false
            },
            {
              "x": "`x_c2`",
              "y": "`y_c2`",
              "arc": false
            },
            {
              "x": "`x_c3`",
              "y": "`y_c3`",
              "arc": false
            },
            {
              "x": "`x_c4`",
              "y": "`y_c4`",
              "arc": false
            }
          ],
          "refIndex": "`core_n`"
        },
        {
          "type": "Glass",
          "path": [
            {
              "x": "`x_c1`",
              "y": "`y_c1`",
              "arc": false
            },
            {
              "x": "`x_c2`",
              "y": "`y_c2`",
              "arc": false
            },
            {
              "x": "`x_o2`",
              "y": "`y_o2`",
              "arc": false
            },
            {
              "x": "`x_o1`",
              "y": "`y_o1`",
              "arc": false
            }
          ],
          "refIndex": "`cladding_n`"
        },
        {
          "type": "Glass",
          "path": [
            {
              "x": "`x_c4`",
              "y": "`y_c4`",
              "arc": false
            },
            {
              "x": "`x_c3`",
              "y": "`y_c3`",
              "arc": false
            },
            {
              "x": "`x_o3`",
              "y": "`y_o3`",
              "arc": false
            },
            {
              "x": "`x_o4`",
              "y": "`y_o4`",
              "arc": false
            }
          ],
          "refIndex": "`cladding_n`"
        },
        {
          "type": "Blocker",
          "p1": {
            "x": "`x_o1`",
            "y": "`y_o1`"
          },
          "p2": {
            "x": "`x_o2`",
            "y": "`y_o2`"
          }
        },
        {
          "type": "Blocker",
          "p1": {
            "x": "`x_o4`",
            "y": "`y_o4`"
          },
          "p2": {
            "x": "`x_o3`",
            "y": "`y_o3`"
          }
        }
      ]
    }
  },
  "objs": [
    {
      "type": "ModuleObj",
      "module": "OpticalFiber",
      "points": [
        {
          "x": 500,
          "y": 400
        },
        {
          "x": 1200,
          "y": 400
        }
      ],
      "params": {
        "core_thickness": 20,
        "cladding_thickness": 10,
        "core_n": 1.5,
        "cladding_n": 1.45
      }
    },
    {
      "type": "AngleSource",
      "p1": {
        "x": 500,
        "y": 400
      },
      "p2": {
        "x": 600,
        "y": 400
      }
    }
  ]
}
```
