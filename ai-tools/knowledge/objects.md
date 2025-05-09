# Scene Objects

This is a list of objects (optical elements, decorations, etc.) that can be used in the scene or modules, and their JSON representation.

Except for the coordinates, all parameters listed below are the default values, and can be omitted if they are not changed.

## Light Source

In each light source below, the `wavelength` property is only effective when `simulateColors` of the scene is set to `true`. To simulate color spectrum, you need to overlap multiple light sources with different wavelengths.

### Single Ray

A light source that emits a single ray of light from point `p1` towards point `p2`.

```json
{
  "type": "SingleRay",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 600, "y": 300 },
  "brightness": 1,
  "wavelength": 540
}
```

### Beam

A beam of light emitted from a line segment defined by two points `p1` and `p2`. The rays are emitted **perpendicular to** the line segment (or with an emission angle of spreading), **not** from `p1` to `p2`. In the following example the rays goes towards the right.

```json
{
  "type": "Beam",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "brightness": 0.5,
  "wavelength": 540,
  "emisAngle": 0,
  "lambert": false
}
```

### 360 Degree Point Source

A point source of light at $(x,y)$.

```json
{
  "type": "PointSource",
  "x": 500,
  "y": 300,
  "brightness": 0.5,
  "wavelength": 540
}
```

### Finite Angle Point Source

A point source of light at `p1` pointing towards `p2` with a finite angle of emission.

```json
{
  "type": "AngleSource",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 600, "y": 300 },
  "brightness": 0.5,
  "wavelength": 540,
  "emisAngle": 30
}
```

## Mirror

In each mirror below, if `filter` is set to `true`, the mirror will only reflect light within `wavelength`-`bandwidth` and `wavelength`+`bandwidth`. If both `filter` and `invert` are set to `true`, the mirror will only reflect light outside that range. The `filter` property is only effective when `simulateColors` of the scene is set to `true`.

### Linear Mirror

A mirror with the shape of a line segment defined by two points `p1` and `p2`.

```json
{
  "type": "Mirror",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "filter": false,
  "invert": false,
  "wavelength": 540,
  "bandwidth": 10
}
```

### Arc Mirror

A mirror with the shape of a circular arc. The arc is defined by two endpoints (`p1` and `p2`) and an additional point on the arc (`p3`) that determines its curvature. In the following example the focal point is at the left of the surface.

```json
{
  "type": "ArcMirror",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "p3": { "x": 510, "y": 350 },
  "filter": false,
  "invert": false,
  "wavelength": 540,
  "bandwidth": 10
}
```

### Parabolic Mirror

A mirror with the shape of a parabola. The parabola is defined by two endpoints (`p1` and `p2`) and the vertex (`p3`). In the following example the focal point is at the left of the surface.

```json
{
  "type": "ParabolicMirror",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "p3": { "x": 510, "y": 350 },
  "filter": false,
  "invert": false,
  "wavelength": 540,
  "bandwidth": 10
}
```

### Custom Equation Mirror

A mirror with the shape of a custom equation $y = f(x)$. The equation `eqn` is the function $f(x)$ in **LaTeX format** (unlike the module template which uses math.js). $(x,y)$ is in the local coordinates in which `p1` and `p2` are $(-1,0)$ and $(1,0)$, respectively. In the following example the final curve in the scene coordinates is $y = 25\cdot\sqrt{1-\left(\frac{x-50}{50}\right)^2}$.

```json
{
  "type": "CustomMirror",
  "p1": { "x": 0, "y": 0 },
  "p2": { "x": 100, "y": 0 },
  "eqn": "0.5\\cdot\\sqrt{1-x^2}",
  "filter": false,
  "invert": false,
  "wavelength": 540,
  "bandwidth": 10
}
```

To use module parameters or variables in the equation, you need to wrap them in backticks, for example, the following module generates a mirror with shape $y = \cos(2 \pi x+\phi)$ in local coordinates with adjustable phase $\phi$.

```json
{
  "numPoints": 0,
  "params": ["phi=0:0.01:2pi:1"],
  "objs": [
    {
      "type": "CustomMirror",
      "p1": { "x": 0, "y": 0 },
      "p2": { "x": 100, "y": 0 },
      "eqn": "\\cos(2 \\pi x+`phi`)"
    }
  ]
}
```

## Blocker

In each blocker below, the if `filter` is set to `true`, the blocker will only block light within `wavelength`-`bandwidth` and `wavelength`+`bandwidth`. If both `filter` and `invert` are set to `true`, the blocker will only block light outside that range. The `filter` property is only effective when `simulateColors` of the scene is set to `true`.

### Linear Blocker

A blocker with the shape of a line segment defined by two points `p1` and `p2`.

```json
{
  "type": "Blocker",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "filter": false,
  "invert": false,
  "wavelength": 540,
  "bandwidth": 10
}
```

### Circular Blocker

A blocker with the shape of a circle. The circle is defined by the center (`p1`) and a point on the circle (`p2`).

```json
{
  "type": "CircleBlocker",
  "p1": { "x": 500, "y": 500 },
  "p2": { "x": 600, "y": 500 },
  "filter": false,
  "invert": false,
  "wavelength": 540,
  "bandwidth": 10
}
```

## Glass

In each glass below, the `refIndex` property is the index of refraction of the glass. If multiple glasses overlap, the index of refraction in the overlapping region is the product of the indices of refraction of the overlapping glasses. When `simulateColors` of the scene is set to `true`, the `refIndex` is the Cauchy coefficient $A$, and `cauchyB` is the Cauchy coefficient $B$ in micrometer squared in the Cauchy equation $n = A + \frac{B}{\lambda^2}$.

### Half-plane Glass

A glass with the shape of a half-plane defined by two points `p1` and `p2` on its surface. In the example below, the glass extends downward.

```json
{
  "type": "PlaneGlass",
  "p1": { "x": 500, "y": 400 },
  "p2": { "x": 600, "y": 400 },
  "refIndex": 1.5,
  "cauchyB": 0.004
}
```

### Circular Glass

A glass with the shape of a circle. The circle is defined by the center (`p1`) and a point on the circle (`p2`).

```json
{
  "type": "CircleGlass",
  "p1": { "x": 500, "y": 500 },
  "p2": { "x": 600, "y": 500 },
  "refIndex": 1.5,
  "cauchyB": 0.004
}
```

### Polygonal / Circular Arc Glass

A glass with the shape constructed from line segments and circular arcs. The `path` is an array of object with `x` and `y` properties for coordinates, and a boolean `arc`. If `path[i].arc === false`, it means that `path[i-1]`--`path[i]` and `path[i]`--`path[i+1]` are line segments, if `path[i].arc === true`, it means that `path[i-1]`--`path[i]`--`path[i+1]` is a circular arc (where the three points are on the arc).

For example, the following is a rectangle:

```json
{
  "type": "Glass",
  "path": [
    { "x": 500, "y": 500, "arc": false },
    { "x": 600, "y": 500, "arc": false },
    { "x": 600, "y": 600, "arc": false },
    { "x": 500, "y": 600, "arc": false }
  ],
  "refIndex": 1.5,
  "cauchyB": 0.004
}
```

The following is a semi-circle where the arc is to the right of the straight segment:

```json
{
  "type": "Glass",
  "path": [
    { "x": 500, "y": 500, "arc": false },
    { "x": 500, "y": 600, "arc": false },
    { "x": 550, "y": 550, "arc": true }
  ],
  "refIndex": 1.5,
  "cauchyB": 0.004
}
```

### Custom Equation Glass

A glass with the shape $f(x) < y < g(x)$. The equations `eqn1` and `eqn2` are the functions $f(x)$ and $g(x)$ in **LaTeX format** (unlike the module template which uses math.js), respectively. $(x,y)$ is in the local coordinates in which `p1` and `p2` are $(-1,0)$ and $(1,0)$, respectively. In the following example the final curve in the scene coordinates is $-50\cdot\sqrt{1-\left(\frac{x-50}{50}\right)^2} < y < 25\cdot\sqrt{1-\left(\frac{x-50}{50}\right)^2}$.

```json
{
  "type": "CustomGlass",
  "p1": { "x": 0, "y": 0 },
  "p2": { "x": 100, "y": 0 },
  "eqn1": "-\\sqrt{1-x^2}",
  "eqn2": "0.5\\cdot\\sqrt{1-x^2}",
  "refIndex": 1.5,
  "cauchyB": 0.004
}
```

To use module parameters or variables in the equation, you need to wrap them in backticks, for example, the following module generates a glass with shape $-1 < y < \cos(2 \pi x+\phi)$ in local coordinates with adjustable phase $\phi$.

```json
{
  "numPoints": 0,
  "params": ["phi=0:0.01:2pi:1"],
  "objs": [
    {
      "type": "CustomGlass",
      "p1": { "x": 0, "y": 0 },
      "p2": { "x": 100, "y": 0 },
      "eqn1": "-1",
      "eqn2": "\\cos(2 \\pi x+`phi`)"
    }
  ]
}
```

### Spherical Lens

A spherical lens with a flat top and bottom surface, and two circular arc surfaces. When approximated as a thin lens, it is like a line segment from `p1` to `p2`. More accurately, when the lens is placed vertically, `p1` and `p2` are on the midpoint of the top and bottom surfaces, and their horizontal position are in the midpoint of the segment formed by the intersection of the optical axis and the lens.

To define the lens with parameters $d$ (the length of the segment formed by the intersection of the optical axis and the lens), $R_1$ and $R_2$ (the radius of curvature of the left and right surfaces, respectively) use the syntax:

```json
{
  "type": "SphericalLens",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "defBy": "DR1R2",
  "params": { "d": 50, "r1": 100, "r2": -100 },
  "refIndex": 1.5,
  "cauchyB": 0.004
}
```

The above defines a biconvex lens. To have a plano-convex or plano-concave lens, set the radius of curvature of the flat surface to the string `"inf"`.

To define the lens with parameters $d$ (the length of the segment formed by the intersection of the optical axis and the lens), FFD and BFD (the focal distances of the left and right surfaces, respectively) use the syntax:

```json
{
  "type": "SphericalLens",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "defBy": "DFfdBfd",
  "params": { "d": 50, "ffd": 200, "bfd": 250 },
  "refIndex": 1.5,
  "cauchyB": 0.004
}
```

## Ideal Objects

### Ideal Lens

A ideal lens defined by a segment (the shape of the infinitely thin lens) from `p1` to `p2` and a focal length (positive for converging, negative for diverging).

```json
{
  "type": "IdealLens",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "focalLength": 100
}
```

### Ideal Curved Mirror

A ideal curved mirror defined by a segment (the nearly flat surface under the paraxial approximation) from `p1` to `p2` and a focal length (positive for converging, negative for diverging).

```json
{
  "type": "IdealCurvedMirror",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "focalLength": 100
}
```

## Diffraction Grating

In each diffraction grating below, the `lineDensity` property is the number of lines per millimeter. To control the intensity, one way is to assume it is an array of microscopic blockers which blocks a ratio of `slitRatio` of the line segment:

Another way is to set `customIntensity` to `true` and set `brightnesses` to an array of numbers between 0 and 1. The numbers in the array correspond to m = 0, 1, -1, 2, -2, …. The number is to be normalized to the brightness of the incident ray.

### Linear Diffraction Grating

A trasmittive (`mirrored == false`) or reflective (`mirrored == true`) linear diffraction grating defined by a segment from `p1` to `p2`.

```json
{
  "type": "DiffractionGrating",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "lineDensity": 100,
  "mirrored": true,
  "slitRatio": 0.5,
  "customIntensity": false,
  "brightnesses": [
    1,
    0.5,
    0.5
  ]
}
```

### Convex Diffraction Grating

A reflective diffraction grating with the shape of a circular arc. The arc is defined by two endpoints (`p1` and `p2`) and an additional point on the arc (`p3`) that determines its curvature. In the following example the focal point is at the left of the surface.

```json
{
  "type": "ConvexDiffractionGrating",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "p3": { "x": 510, "y": 350 },
  "lineDensity": 100,
  "slitRatio": 0.5,
  "customIntensity": false,
  "brightnesses": [
    1,
    0.5,
    0.5
  ]
}
```

## Beam Splitter

### Linear Beam Splitter

A linear beam splitter defined by a segment from `p1` to `p2` and a transmission ratio.

```json
{
  "type": "BeamSplitter",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 500, "y": 400 },
  "transRatio": 0.5
}
```

## GRIN Glass

In each GRIN glass below, the `refIndexFn` property is the reference index function $n(x,y,\lambda)$ in **LaTeX format** (unlike the module template which uses math.js), where $\lambda$ is the wavelength. The function is defined in the shifted coordinates where the `origin` is $(0,0)$. As in normal glass, if multiple GRIN glasses overlap (or even a normal glass and a GRIN glass), the index of refraction in the overlapping region is the product of the indices of refraction of the overlapping glasses.

### Circular GRIN Glass

A circular GRIN glass defined by the shape of a circle with center (`p1`) and a point on the circle (`p2`).

```json
{
  "type": "CircleGrinGlass",
  "p1": { "x": 500, "y": 500 },
  "p2": { "x": 500, "y": 600 },
  "refIndexFn": "1+e^{-\\frac{x^2+y^2}{50^2}}",
  "origin": { "x": 500, "y": 500 }
}
```

### Polygonal GRIN Glass

A polygonal GRIN glass defined by the `path` property, which is an array of points.

```json
{
  "type": "GrinGlass",
  "path": [
    { "x": 500, "y": 500 },
    { "x": 600, "y": 500 },
    { "x": 600, "y": 600 },
    { "x": 500, "y": 600 }
  ],
  "refIndexFn": "1+e^{-\\frac{x^2+y^2}{50^2}}",
  "origin": { "x": 500, "y": 500 }
}
```

To use module parameters or variables in the reference index function, you need to wrap them in backticks, for example, the following module generates a glass with reference index $1+e^{-\frac{x^2+y^2}{r^2}}$ with adjustable radius $r$.

```json
{
  "numPoints": 0,
  "params": ["r=1:10:100:1"],
  "objs": [
    {
      "type": "GrinGlass",
      "path": [
        { "x": 500, "y": 500 },
        { "x": 600, "y": 500 },
        { "x": 600, "y": 600 },
        { "x": 500, "y": 600 }
      ],
      "refIndexFn": "1+e^{-\\frac{x^2+y^2}{`r`^2}}",
      "origin": { "x": 500, "y": 500 }
    }
  ]
}
```

## Decorations

### Text Label

A text label at $(x,y)$.

```json
{
  "type": "TextLabel",
  "x": 500,
  "y": 300,
  "text": "Label",
  "fontSize": 24,
  "aligement": "left"
}
```

### Line / Arrow

A line or arrow from `p1` to `p2`.

```json
{
  "type": "LineArrow",
  "p1": { "x": 500, "y": 300 },
  "p2": { "x": 600, "y": 300 },
  "arrow": false,
  "backArrow": false
}
```