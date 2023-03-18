import numpy as np
import json

thickness = 1 # thickness of a single dielectric rectangle
L = 1000 # horizontal length of the lens
R = 100 # lens radius
alpha = (3**0.5)/(2*R) # the lens's refractive index parameter
n0 = 2 # refractive index of the lens's central axis
displacement = 3*R # displacement between the two lenses
y = np.arange(-R,R+thickness,thickness) # vertical coordinates of the dielectric rectangles
n = n0*np.sqrt(1-(alpha*y)**2) # the lens's refractive index profile
x_origin = 500 # simulation origin coordinates
y_origin = 400 #

# initialize the simulation general properties
Dict = dict()
Dict['version'] = 2
Dict['objs'] = []
Dict['mode'] = "light"
Dict['rayDensity_light'] = 0.1
Dict['rayDensity_images'] = 1
Dict['observer'] = None
Dict['origin'] = {'x':x_origin,'y':y_origin}
Dict['scale'] = 1
Dict['colorMode'] = False

# build the first lens from dielectric rectangles
for i in range(len(n)):
    Dict['objs'].append({"type":"refractor", "path":[{'x':0, 'y':y[i], 'arc': False} ,
    {'x':L, 'y':y[i], 'arc': False} , {'x':L, 'y':y[i]-thickness, 'arc': False} ,
    {'x':0, 'y':y[i]-thickness, 'arc': False}], "notDone": False, "p": n[i]})

# build the second lens from dielectric rectangles    
for i in range(len(n)):
    Dict['objs'].append({"type":"refractor", "path":[{'x':0, 'y':y[i]+displacement, 'arc': False} ,
    {'x':L, 'y':y[i]+displacement, 'arc': False} , {'x':L, 'y':y[i]+displacement-thickness, 'arc': False} , 
    {'x':0, 'y':y[i]+displacement-thickness, 'arc': False}], "notDone": False, "p": n[i]})

# int32 type is not serializable, therefore convert it to int type
def convert(o):
    if isinstance(o, np.int32): return int(o)  
    raise TypeError

json_Dict = json.dumps(Dict, default=convert) # converts the dictionary to a json formatted string

# create the json (simulation) file
with open("grin-lens.json", "w") as f:
    f.write(json_Dict)
