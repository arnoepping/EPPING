# Builds the night street (Amsterdam School corner building, after Hoofddorpplein) in Blender, bakes the lighting
# into lightmaps and exports public/models/street.glb + public/models/lightmaps/*.jpg.
# Run: blender -b --factory-startup --python blender/street.py   (optionally: -- --preview to also render a check image)
#
# Coordinates: Blender is Z-up; glTF export turns (x, y, z) into three.js (x, z, -y). So the facade front is at y = 0,
# the street at y < 0 (three.js z > 0), the building at y > 0. The club door (x -0.6..0.6, height 2.3) stays open:
# the door, neon sign, rope and stairwell are three.js.
import bpy, bmesh, math, os, random, sys
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX = os.path.join(ROOT, 'blender', 'textures', 'web')  # web-sized copies of the Poly Haven maps (see textures/)
OUT = os.path.join(ROOT, 'public', 'models')
LM = os.path.join(OUT, 'lightmaps')
os.makedirs(LM, exist_ok=True)
PREVIEW = '--preview' in sys.argv
QUICK = '--quick' in sys.argv  # low samples + small lightmaps, to test the script
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- materials
def tex_material(name, base, tile, rough=None, nor=None, tint=(1, 1, 1, 1)):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    img = nt.nodes.new('ShaderNodeTexImage'); img.image = bpy.data.images.load(os.path.join(TEX, base))
    if tint != (1, 1, 1, 1):
        mixn = nt.nodes.new('ShaderNodeMix'); mixn.data_type = 'RGBA'; mixn.blend_type = 'MULTIPLY'; mixn.inputs['Factor'].default_value = 1
        nt.links.new(img.outputs['Color'], mixn.inputs['A']); mixn.inputs['B'].default_value = tint
        nt.links.new(mixn.outputs['Result'], b.inputs['Base Color'])
    else:
        nt.links.new(img.outputs['Color'], b.inputs['Base Color'])
    if rough:
        r = nt.nodes.new('ShaderNodeTexImage'); r.image = bpy.data.images.load(os.path.join(TEX, rough)); r.image.colorspace_settings.name = 'Non-Color'
        nt.links.new(r.outputs['Color'], b.inputs['Roughness'])
    if nor:
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(os.path.join(TEX, nor)); n.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    m['tile'] = tile
    return m

def flat(name, rgb, rough=0.6, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    return m

BRICK = tex_material('brick', 'red_brick_03_diff_web.jpg', 1.6, 'red_brick_03_rough_web.jpg', 'red_brick_03_nor_web.jpg', tint=(0.85, 0.72, 0.68, 1))
PAVE = tex_material('pavement', 'concrete_pavement_02_diff_web.jpg', 1.8, 'concrete_pavement_02_rough_web.jpg', 'concrete_pavement_02_nor_web.jpg', tint=(0.7, 0.68, 0.7, 1))
ROAD = tex_material('road', 'asphalt_02_diff_web.jpg', 3.0, 'asphalt_02_rough_web.jpg', 'asphalt_02_nor_web.jpg', tint=(0.55, 0.55, 0.6, 1))
TRIM = flat('trim', (0.86, 0.84, 0.78), 0.5)              # white window frames, canopy band, stripes
DARK = flat('dark', (0.025, 0.02, 0.025), 0.45, 0.3)      # bikes, poles, frames of shopfronts
BOLLARD = flat('bollard', (0.22, 0.06, 0.04), 0.5)         # Amsterdammertjes
LEAF = flat('leaf', (0.03, 0.06, 0.03), 0.8)
BARK = flat('bark', (0.06, 0.045, 0.035), 0.9)
GLASS = flat('glass', (0.01, 0.012, 0.02), 0.08, 0.6)     # dark window glass, reflective
WARM = flat('window_lit', (0.0, 0.0, 0.0), 0.3, 0, emit=(1.0, 0.55, 0.25), strength=4.0)   # lit rooms (exported as emissive)
DIM = flat('window_dim', (0.0, 0.0, 0.0), 0.3, 0, emit=(0.9, 0.5, 0.35), strength=1.2)     # rooms with curtains / a lamp further back
KERB = flat('kerb', (0.32, 0.31, 0.3), 0.8)
SHOP = flat('shop_lit', (0.01, 0.01, 0.012), 0.1, 0.6, emit=(1.0, 0.7, 0.45), strength=0.6)  # closed shops: dark glass, faint light inside
LAMP = flat('lamp_head', (0, 0, 0), 0.3, 0, emit=(1.0, 0.7, 0.42), strength=30)

# ---------------------------------------------------------------- geometry helpers
def box(name, mat, x0, x1, y0, y1, z0, z1, bevel=0.0):
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1); bm.to_mesh(me); bm.free()
    ob.scale = ((x1 - x0), (y1 - y0), (z1 - z0)); ob.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    me.materials.append(mat)
    if bevel:
        mod = ob.modifiers.new('bevel', 'BEVEL'); mod.width = bevel; mod.segments = 2
    return ob

def cyl(name, mat, x, y, z0, z1, r, verts=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=z1 - z0, location=(x, y, (z0 + z1) / 2))
    ob = bpy.context.object; ob.name = name; ob.data.materials.append(mat); return ob

def sphere(name, mat, x, y, z, r, sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=(x, y, z))
    ob = bpy.context.object; ob.name = name; ob.data.materials.append(mat); return ob

# ---------------------------------------------------------------- the building
H_GROUND, H_FLOOR, FLOORS = 4.0, 3.1, 3
TOP = H_GROUND + H_FLOOR * FLOORS
X0, X1, DEPTH = -13.0, 10.0, 0.4
# brick facade around the door opening (door: x -0.6..0.6, z 0..2.3)
box('facade_l', BRICK, X0, -0.6, 0, DEPTH, 0, TOP)
box('facade_r', BRICK, 0.6, X1, 0, DEPTH, 0, TOP)
box('facade_top', BRICK, -0.6, 0.6, 0, DEPTH, 2.3, TOP)
# rounded corner tower at the right end, turning down the side street, taller like on the plein
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=2.2, depth=TOP + 2.5, location=(X1, 2.2, (TOP + 2.5) / 2))
corner = bpy.context.object; corner.name = 'corner'; corner.data.materials.append(BRICK)
box('side_wall', BRICK, X1, X1 + 0.4, 2.2, 14, 0, TOP)
# brick bands and cornice (Amsterdam School horizontals)
for z in [H_GROUND + k * H_FLOOR for k in range(FLOORS)] + [TOP]:
    box(f'band_{z:.1f}', BRICK, X0, X1, -0.12, 0.05, z - 0.1, z + 0.12)
box('cornice', BRICK, X0, X1, -0.25, 0.05, TOP + 0.12, TOP + 0.45)
box('parapet', BRICK, X0, X1, 0, DEPTH, TOP + 0.45, TOP + 1.1)

# windows on the upper floors: white frames, a cross mullion, glass; some rooms lit
lit_windows = []
cols = [x for x in [-11.5, -9.2, -6.9, -4.6, -2.3, 2.3, 4.6, 6.9]]
for f in range(FLOORS):
    z0 = H_GROUND + f * H_FLOOR + 0.7
    for x in cols + [0.0]:
        w, h = 1.25, 1.75
        r = random.random(); lit = r < 0.4
        box('glass', WARM if r < 0.2 else DIM if lit else GLASS, x - w / 2, x + w / 2, -0.02, 0.0, z0, z0 + h)
        if lit: lit_windows.append((x, z0 + h / 2))
        t, d = 0.07, -0.06
        box('frame', TRIM, x - w / 2 - t, x + w / 2 + t, d, 0.0, z0 - t, z0)            # sill side
        box('frame', TRIM, x - w / 2 - t, x + w / 2 + t, d, 0.0, z0 + h, z0 + h + t)
        box('frame', TRIM, x - w / 2 - t, x - w / 2, d, 0.0, z0, z0 + h)
        box('frame', TRIM, x + w / 2, x + w / 2 + t, d, 0.0, z0, z0 + h)
        box('frame', TRIM, x - 0.025, x + 0.025, d, 0.0, z0, z0 + h)                     # mullion
        box('frame', TRIM, x - w / 2, x + w / 2, d, 0.0, z0 + h * 0.68, z0 + h * 0.68 + 0.05)  # transom
        box('sill', TRIM, x - w / 2 - 0.12, x + w / 2 + 0.12, -0.16, 0.0, z0 - 0.1, z0 - 0.02)

# ground floor: two shopfronts (closed for the night, dimly lit) with a cream canopy band; gap around the club door
for sx0, sx1 in [(-11.8, -2.2), (2.2, 8.6)]:
    box('shop_glass', SHOP, sx0, sx1, -0.03, 0.0, 0.55, 3.0)
    for k in range(int((sx1 - sx0) / 1.6) + 1):
        x = sx0 + k * (sx1 - sx0) / int((sx1 - sx0) / 1.6)
        box('shop_frame', DARK, x - 0.05, x + 0.05, -0.08, 0.0, 0.5, 3.05)
    box('shop_frame', DARK, sx0, sx1, -0.08, 0.0, 0.45, 0.58)
    box('shop_frame', DARK, sx0, sx1, -0.08, 0.0, 2.98, 3.08)
    box('canopy', TRIM, sx0 - 0.3, sx1 + 0.3, -0.45, 0.0, 3.25, 3.75)

# ---------------------------------------------------------------- the street
box('sidewalk', PAVE, -30, 30, -4.6, 0.0, -0.05, 0.0)
box('kerb', KERB, -30, 30, -4.75, -4.6, -0.18, 0.0)
box('road', ROAD, -30, 30, -22, -4.75, -0.2, -0.18)
for k in range(8):  # zebra crossing toward the door: bars along the road, stepped over on the way in
    y0 = -5.2 - k * 1.05
    box('zebra', TRIM, -2.2, 2.2, y0 - 0.5, y0, -0.18, -0.175)
for x in [-7.0, -4.0, 4.0, 7.0, 10.5, -10.5]:  # Amsterdammertjes along the kerb
    cyl('bollard', BOLLARD, x, -4.35, 0, 0.75, 0.065)
    sphere('bollard_top', BOLLARD, x, -4.35, 0.78, 0.07)

# trees on the sidewalk
for tx in [-4.2, 4.6]:  # framing the door, like the trees on the plein
    cyl('trunk', BARK, tx, -3.4, 0, 4.2, 0.14, 10)
    for k in range(9):
        a = k / 9 * math.tau
        sphere('crown', LEAF, tx + math.cos(a) * 1.3 * random.uniform(0.5, 1), -3.4 + math.sin(a) * 1.3 * random.uniform(0.5, 1), 5.2 + random.uniform(-0.6, 1.4), random.uniform(1.0, 1.6), 1)

# parked bikes against the facade, right of the door
def bike(x, lean):
    for dx in (-0.55, 0.55):
        bpy.ops.mesh.primitive_torus_add(major_segments=24, minor_segments=4, major_radius=0.33, minor_radius=0.02, location=(x + dx, -0.45, 0.35), rotation=(math.pi / 2, 0, 0))
        w = bpy.context.object; w.name = 'wheel'; w.data.materials.append(DARK); w.rotation_euler.z = lean
    for a, b in [((-0.55, 0.35), (0.0, 0.75)), ((0.0, 0.75), (0.55, 0.35)), ((0.0, 0.75), (0.45, 0.85)), ((-0.55, 0.35), (-0.4, 0.95))]:
        p, q = Vector((x + a[0], -0.45, a[1])), Vector((x + b[0], -0.45, b[1]))
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.018, depth=(q - p).length, location=(p + q) / 2)
        c = bpy.context.object; c.name = 'bike_tube'; c.data.materials.append(DARK)
        c.rotation_euler = (q - p).to_track_quat('Z', 'Y').to_euler()
for bx in [2.6, 3.4, 6.2, 9.2]:
    bike(bx, random.uniform(-0.15, 0.15))

# Amsterdam street lamp (post + arm + head) left of the door
cyl('lamp_post', DARK, -2.6, -4.2, 0, 4.6, 0.07)
box('lamp_arm', DARK, -2.6, -1.8, -4.23, -4.17, 4.5, 4.58)
LAMP_POS = Vector((-1.8, -4.2, 4.4))
sphere('lamp_head', LAMP, LAMP_POS.x, LAMP_POS.y, LAMP_POS.z, 0.16, 2)

# ---------------------------------------------------------------- lights for the bake
def light(name, kind, loc, energy, color, size=0.3, rot=None):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = color
    if kind == 'AREA': ld.size = size
    if kind in ('POINT', 'SPOT'): ld.shadow_soft_size = size
    ob = bpy.data.objects.new(name, ld); ob.location = loc; scene.collection.objects.link(ob)
    if rot: ob.rotation_euler = rot
    return ob
light('lamp', 'POINT', LAMP_POS - Vector((0, 0, 0.25)), 900, (1.0, 0.72, 0.45), 0.25)
light('neon_sign', 'AREA', (0, -0.6, 2.95), 160, (1.0, 0.17, 0.84), 2.4, rot=(math.radians(90), 0, 0))   # the EPPING sign's glow (pulse added live)
light('door_leak', 'POINT', (0, -0.3, 0.05), 25, (1.0, 0.17, 0.84), 0.2)
light('shop_spill_l', 'AREA', (-7, -0.6, 1.8), 120, (1.0, 0.75, 0.5), 3, rot=(math.radians(90), 0, 0))
light('shop_spill_r', 'AREA', (5.4, -0.6, 1.8), 120, (1.0, 0.75, 0.5), 3, rot=(math.radians(90), 0, 0))
light('far_lamp', 'POINT', (9, -5, 5), 500, (1.0, 0.72, 0.45), 0.25)
w = bpy.data.worlds.new('night'); scene.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.05, 0.03, 0.09, 1); bg.inputs['Strength'].default_value = 0.6  # dusk sky fill

# ---------------------------------------------------------------- merge per material, UVs, bake
bpy.ops.object.select_all(action='DESELECT')
for ob in list(scene.objects):
    if ob.type != 'MESH': continue
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    for mod in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ob.select_set(False)

groups = {}
for ob in list(scene.objects):
    if ob.type == 'MESH': groups.setdefault(ob.data.materials[0].name, []).append(ob)
merged = {}
for mat, obs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs: ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1: bpy.ops.object.join()
    ob = bpy.context.object; ob.name = mat; merged[mat] = ob

def uv_world(ob, tile):
    """UV0: box projection in metres / tile, so textures repeat at real-world scale."""
    me = ob.data; bm = bmesh.new(); bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = ob.matrix_world @ l.vert.co
            u, v = ((co.y, co.z), (co.x, co.z), (co.x, co.y))[ax]
            l[uv].uv = (u / tile, v / tile)
    bm.to_mesh(me); bm.free()

BAKE = {'brick': 2048, 'pavement': 1024, 'road': 1024, 'trim': 1024, 'kerb': 512, 'dark': 512, 'bollard': 256, 'bark': 256, 'leaf': 512}
scene.render.engine = 'CYCLES'; scene.cycles.samples = 8 if QUICK else 96; scene.cycles.device = 'CPU'
scene.view_settings.view_transform = 'Standard'  # lightmaps must not be tone-mapped
try: scene.cycles.use_denoising = True
except Exception: pass
for mat, ob in merged.items():
    me = ob.data
    if mat in ('brick', 'pavement', 'road'): uv_world(ob, me.materials[0]['tile'])
    elif not me.uv_layers: me.uv_layers.new(name='UVMap')
    if mat not in BAKE: continue
    lm = me.uv_layers.new(name='lightmap'); me.uv_layers.active = lm
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    size = 128 if QUICK else BAKE[mat]
    img = bpy.data.images.new(f'lm_{mat}', size, size, float_buffer=True)
    nt = me.materials[0].node_tree; node = nt.nodes.new('ShaderNodeTexImage'); node.image = img
    for n in nt.nodes: n.select = False
    node.select = True; nt.nodes.active = node
    print('baking', mat, size, flush=True)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=6, use_clear=True)
    img.filepath_raw = os.path.join(LM, f'{mat}.jpg'); img.file_format = 'JPEG'
    scene.render.image_settings.file_format = 'JPEG'; scene.render.image_settings.quality = 80  # save_render uses these
    img.save_render(img.filepath_raw, scene=scene)
    nt.nodes.remove(node)
    me.uv_layers.active = me.uv_layers[0]; me.uv_layers[0].active_render = True

# ---------------------------------------------------------------- export
for l in [o for o in scene.objects if o.type == 'LIGHT']: bpy.data.objects.remove(l)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'street.glb'), export_format='GLB', use_selection=True,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='JPEG',
                          export_lights=False, export_cameras=False, export_apply=True,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)
print('exported', os.path.join(OUT, 'street.glb'), flush=True)
