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

## Equations in module definition

The statements in `vars` and the expressions in `objs` are evaluated using math.js. In the strings, there are two types of equation blocks:

- Single-backticks: A math.js expression to be evaluated to a number, used in points coordinates, numerical parameters of objects, and text labels. For example:
```json
"p1": {
  "x": "`x_1 + dx*i`",
  "y": "`y_1 + dy*i`"
}
```
- Double-backticks: A math.js formula to be evaluated to a formula string with free variables like \(t\), used in equation parameters of objects. For example:
```json
{
  "eqnX": "``x_1 + r(t) * cos(t)``",
  "eqnY": "``y_1 + r(t) * sin(t)``"
}
```

All math.js syntax and operations are available in `vars`, `for`, `if`, and single-backticks. However, for double-backticks, and the function definitions in `vars` which are referenced by double-backticks, the allowed operations depends on where the equation is used.

In refactive index functions of GRIN glasses, only the following are available (and the combination must be differentiable):
- Constants: `pi`, `e`
- Operators: `+`, `-`, `*`, `/`, `^` (do not use implicit multiplication)
- Functions: `sqrt`, `sin`, `cos`, `tan`, `sec`, `csc`, `cot`, `sinh`, `cosh`, `tanh`, `log`, `asin`, `acos`, `atan` (use `e^x` instead of `exp(x)`)

In other equation parameters, the following are available in addition to the above (and no requirement for differentiability):
- Functions: `exp`, `asinh`, `acosh`, `atanh`, `floor`, `ceil`, `round`, `abs`, `sign`, `min`, `max`

## Examples

You may look for examples similar to the user's request before writing your own code.

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
        "tStep=0.001:0.001:0.1:0.01"
      ],
      "vars": [
        "tMax=2*pi*turns",
        "r(t)=a*t"
      ],
      "objs": [
        {
          "type": "ParamMirror",
          "pieces": [
            {
              "eqnX": "``x_1 + r(t) * cos(t)``",
              "eqnY": "``y_1 + r(t) * sin(t)``",
              "tMin": 0,
              "tMax": "`tMax`",
              "tStep": "`tStep`"
            }
          ]
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
        "tStep": 0.005
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

First, the `ChaffPiece` module is defined to represent a single linear mirror itself, with position `(x,y)`, angle `theta`, and length `L`. Then, the `Chaff` module is defined to represent a collection of random linear mirrors, with number `N` and length `L` of chaff pieces.

```json
{
  "version": 5,
  "modules": {
    "ChaffPiece": {
      "numPoints": 1,
      "params": [
        "theta=0:0.001:2pi:0",
        "L=0.01:0.01:10:5"
      ],
      "objs": [
        {
          "type": "Mirror",
          "p1": {
            "x": "`x_1`",
            "y": "`y_1`"
          },
          "p2": {
            "x": "`x_1+L*cos(theta)`",
            "y": "`y_1+L*sin(theta)`"
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
          "points": [
            {
              "x": "`x_1+random()*(x_2-x_1)`",
              "y": "`y_1+random()*(y_2-y_1)`"
            }
          ],
          "params": {
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

### A spherical lens with single-layer coatings on both sides (with a beam going through)

First, the `ArcCoating` module is defined to represent a single arc-shaped thin-film layer itself, with thickness `d` in nanometers (note that it is not the geometric thickness in scene coordinates, where it is just a curve with no thickness) and Cauchy coefficients `A` and `B` of the coating material (note that `n_0` and `n_1` appearing in `eqnTheta` and `eqnP` are not the parameters of the coating layer, since their values are determined by the glass the coating is attached to). Then, the `CoatedLens` module is defined to represent a spherical lens with anti-reflection coating on both sides, with height `h`, width `d`, radius of curvature `R_1` and `R_2` (in scene units), Cauchy coefficients `A` and `B` for the glass, and includes two `ArcCoating` objects with parameters named `d_c`, `A_c`, and `B_c`.

```json
{
  "version": 5,
  "modules": {
    "ArcCoating": {
      "numPoints": 3,
      "params": [
        "d=0:1:500:110",
        "A=1.1:0.01:3:1.22",
        "B=0.001:0.001:0.02:0.004"
      ],
      "vars": [
        "cauchy(lambda)=A+B/((lambda*0.001)^2)",
        "snell(n_0,n_1,theta_0)=asin(n_0/n_1*sin(theta_0))",
        "fresnel(n_0,n_1,theta_0,theta_1,p)=p*(n_0*cos(theta_1)-n_1*cos(theta_0))/(n_0*cos(theta_1)+n_1*cos(theta_0))+(1-p)*(n_0*cos(theta_0)-n_1*cos(theta_1))/(n_0*cos(theta_0)+n_1*cos(theta_1))",
        "phase(theta,lambda)=2*pi/lambda*cauchy(lambda)*d*cos(theta)",
        "combine(r_0c,r_c1,beta)=(r_0c^2+r_c1^2+2*r_0c*r_c1*cos(2*beta))/(1+r_0c^2*r_c1^2+2*r_0c*r_c1*cos(2*beta))",
        "refl(n_0,n_f,n_1,theta_0,theta_f,theta_1,p,lambda)=combine(fresnel(n_0,n_f,theta_0,theta_f,p),fresnel(n_f,n_1,theta_f,theta_1,p),phase(theta_f,lambda))"
      ],
      "objs": [
        {
          "type": "CustomArcSurface",
          "p1": {
            "x": "`x_1`",
            "y": "`y_1`"
          },
          "p2": {
            "x": "`x_2`",
            "y": "`y_2`"
          },
          "p3": {
            "x": "`x_3`",
            "y": "`y_3`"
          },
          "outRays": [
            {
              "eqnTheta": "``snell(n_0,n_1,theta_0)``",
              "eqnP": "``P_0*(1-refl(n_0,cauchy(lambda),n_1,theta_0,snell(n_0,cauchy(lambda),theta_0),theta_1,p,lambda))``"
            },
            {
              "eqnTheta": "``pi-theta_0``",
              "eqnP": "``P_0-P_1``"
            }
          ],
          "twoSided": true
        }
      ]
    },
    "CoatedLens": {
      "numPoints": 1,
      "params": [
        "h=5:1:100:90",
        "d=5:1:50:60",
        "R_1=-500:1:500:250",
        "R_2=-500:1:500:-250",
        "A=1.1:0.01:3:1.5",
        "B=0.001:0.001:0.02:0.004",
        "d_c=0:1:500:110",
        "A_c=1.1:0.01:3:1.22",
        "B_c=0.001:0.001:0.02:0.004"
      ],
      "vars": [
        "curveShift1 = R_1 - sqrt(R_1^2 - h^2) * sign(R_1)",
        "curveShift2 = R_2 - sqrt(R_2^2 - h^2) * sign(R_2)",
        "x_left = x_1 - d/2",
        "x_right = x_1 + d/2",
        "y_top = y_1 - h",
        "y_bottom = y_1 + h"
      ],
      "objs": [
        {
          "type": "Glass",
          "path": [
            {
              "x": "`x_left + curveShift1`",
              "y": "`y_top`",
              "arc": false
            },
            {
              "x": "`x_right + curveShift2`",
              "y": "`y_top`",
              "arc": false
            },
            {
              "x": "`x_right`",
              "y": "`y_1`",
              "arc": true
            },
            {
              "x": "`x_right + curveShift2`",
              "y": "`y_bottom`",
              "arc": false
            },
            {
              "x": "`x_left + curveShift1`",
              "y": "`y_bottom`",
              "arc": false
            },
            {
              "x": "`x_left`",
              "y": "`y_1`",
              "arc": true
            }
          ],
          "refIndex": "`A`",
          "cauchyB": "`B`"
        },
        {
          "type": "ModuleObj",
          "module": "ArcCoating",
          "points": [
            {
              "x": "`x_left + curveShift1`",
              "y": "`y_top`"
            },
            {
              "x": "`x_left + curveShift1`",
              "y": "`y_bottom`"
            },
            {
              "x": "`x_left`",
              "y": "`y_1`"
            }
          ],
          "params": {
            "d": "`d_c`",
            "A": "`A_c`",
            "B": "`B_c`"
          }
        },
        {
          "type": "ModuleObj",
          "module": "ArcCoating",
          "points": [
            {
              "x": "`x_right + curveShift2`",
              "y": "`y_top`"
            },
            {
              "x": "`x_right + curveShift2`",
              "y": "`y_bottom`"
            },
            {
              "x": "`x_right`",
              "y": "`y_1`"
            }
          ],
          "params": {
            "d": "`d_c`",
            "A": "`A_c`",
            "B": "`B_c`"
          }
        }
      ]
    }
  },
  "objs": [
    {
      "type": "ModuleObj",
      "module": "CoatedLens",
      "points": [
        {
          "x": 620,
          "y": 500
        }
      ],
      "params": {
        "h": 90,
        "d": 60,
        "R_1": 250,
        "R_2": -250,
        "A": 1.5,
        "B": 0.004,
        "d_c": 110,
        "A_c": 1.22,
        "B_c": 0.004
      }
    },
    {
      "type": "Beam",
      "p1": {
        "x": 500,
        "y": 440
      },
      "p2": {
        "x": 500,
        "y": 560
      }
    }
  ],
  "simulateColors": true
}
```
