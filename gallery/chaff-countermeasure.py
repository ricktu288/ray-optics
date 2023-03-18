import numpy as np
import json

Xmax = 1300 # the chaff will be randomly scattered in an Xmax by Ymax rectangle
Ymax = 1300 #
L = 5 # length of a single chaff pieace
N = 10000 # number of chaff pieces
x_origin = 500 # simulation origin coordinates
y_origin = 200 #
scale = 0.5 # simulation initial zoom

# initialize the simulation general properties
Dict = dict()
Dict['version'] = 2
Dict['objs'] = []
Dict['mode'] = "light"
Dict['rayDensity_light'] = 0.1
Dict['rayDensity_images'] = 1
Dict['observer'] = None
Dict['origin'] = {'x':x_origin,'y':y_origin}
Dict['scale'] = scale
Dict['colorMode'] = False

# scatter the N pieces of chaff randomly in an Xmax by Ymax rectangle
for i in range(N):
    x = np.random.rand() * Xmax # generate random coordinates for a single chaff piece
    y = np.random.rand() * Ymax #
    theta = np.random.rand() * np.pi # generate a random angle for a single chaff piece
    Dict['objs'].append({"type":"mirror", "p1": {"type":1, "x":x, "y":y, "exist": True}, # add the chaff piece into the simulation
    "p2": {"type":1, "x":x + L*np.cos(theta), "y":y + L*np.sin(theta), "exist": True},
    "isDichroic": False, "isDichroicFilter": False})

# int32 type is not serializable, therefore convert it to int type
def convert(o):
    if isinstance(o, np.int32): return int(o)  
    raise TypeError

json_Dict = json.dumps(Dict, default=convert) # converts the dictionary to a json formatted string

# create the json (simulation) file
with open("chaff.json", "w") as f:
    f.write(json_Dict)
