import json

f = 40 # lens focal length
d = [80,152] # distance between consecutive lenses in each series, respectively
lensNum = [37,20] # number of lenses in each series, respectively
lensDiameter = 540
beamDisplacement = 40 # the light beam is placed horizontally at "beamDisplacement" to the left of the lens series
beamRadius = 60
x_origin = 0 # simulation origin coordinates
y_origin = 0 #
initial_x = 300 # lenses coordinate displacement
initial_y = 960 #
y_displacement = [0,1.5*lensDiameter] # vertical distance between consecutive series of lenses

# initialize the simulation general properties
Dict = dict()
Dict['version'] = 2
Dict['objs'] = []
Dict['mode'] = "light"
Dict['rayDensity_light'] = 0.25
Dict['rayDensity_images'] = 1
Dict['observer'] = None
Dict['origin'] = {'x':x_origin,'y':y_origin}
Dict['scale'] = 0.4
Dict['colorMode'] = False

# build the series of lenses with the corresponding light beams
for i in range(len(d)):
    for k in range(lensNum[i]):
        Dict['objs'].append({"type":"lens", "p1": {"type": 1, "x":initial_x+k*d[i], # add the k'th lens of the i'th series into the simulation
        "y":initial_y+y_displacement[i], "exist":True}, "p2": {"type": 1, "x":initial_x+k*d[i],
        "y":initial_y+lensDiameter+y_displacement[i], "exist":True}, "p": f }) 
    Dict['objs'].append({"type":"parallel", "p1":{"type": 1, "x":initial_x-beamDisplacement, # add the light beam for the i'th series into the simulation
    "y":0.5*(2*initial_y+lensDiameter)-beamRadius+y_displacement[i], "exist":True}, "p2":{"type": 1,
    "x":initial_x-beamDisplacement, "y":0.5*(2*initial_y+lensDiameter)+beamRadius+y_displacement[i], "exist":True}, "p":0.5})

json_Dict = json.dumps(Dict) # converts the dictionary to a json formatted string

# create the json (simulation) file
with open("ray-relaying.json", "w") as f:
    f.write(json_Dict)
