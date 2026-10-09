"""Run with Blender --background --python scripts/build-senate-assets.py.

Photo-guided pavilion reconstruction, NOT a scan. Dimensions/alignment and roof
heights fit Helsinki RATU 212/213. Ornament dimensions are interpreted from the
credited 2021 photographs. Coordinates below are game metres (x east, y up, z south).
Produces an editable .blend and a batched browser GLB, without runtime Blender.
"""
import bpy, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, rgb, roughness=.8, metallic=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    # Convert sRGB swatches to the linear values glTF expects.
    bs.inputs['Base Color'].default_value=tuple(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in rgb)+(1,)
    bs.inputs['Roughness'].default_value=roughness; bs.inputs['Metallic'].default_value=metallic
    return m

MATS={
 'limewash':material('Pavilion limewash',(.88,.865,.825)),
 'trim':material('Carved plaster',(.96,.945,.91),.72),
 'granite':material('Pavilion granite',(.49,.465,.425),.95),
 'joint':material('Recessed granite joints',(.31,.30,.28)),
 'glass':material('Recessed dark glass',(.16,.23,.26),.25,.2),
 'shutter':material('Bell louvres',(.59,.64,.63)),
 'copper':material('Weathered copper',(.38,.51,.46),.57,.48),
}

class Model:
    def __init__(self): self.batches={}
    def mesh(self, mat, vertices, faces):
        vs,fs=self.batches.setdefault(mat,([],[])); n=len(vs)
        vs.extend((x,-z,y) for x,y,z in vertices)
        fs.extend(tuple(i+n for i in f) for f in faces)
    def box(self,w,h,d,mat,x,y,z,r=0):
        co,si=math.cos(r),math.sin(r)
        v=[(x+dx*co+dz*si,y+dy,z-dx*si+dz*co) for dx,dy,dz in
           [(-w/2,-h/2,-d/2),(w/2,-h/2,-d/2),(w/2,h/2,-d/2),(-w/2,h/2,-d/2),
            (-w/2,-h/2,d/2),(w/2,-h/2,d/2),(w/2,h/2,d/2),(-w/2,h/2,d/2)]]
        self.mesh(mat,v,[(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)])
    def beam(self,a,b,r,mat,segments=8):
        va,vb=Vector(a),Vector(b); direction=(vb-va).normalized()
        cross=direction.cross(Vector((0,1,0)))
        if cross.length<.01: cross=direction.cross(Vector((1,0,0)))
        cross.normalize(); up=direction.cross(cross).normalized()
        points=[tuple(c+r*(cross*math.cos(i*2*math.pi/segments)+up*math.sin(i*2*math.pi/segments))) for c in [va,vb] for i in range(segments)]
        faces=[tuple(reversed(range(segments))),tuple(range(segments,2*segments))]
        faces += [(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)]
        self.mesh(mat,points,faces)
    def finish(self,name,x,z,angle):
        root=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(root)
        root.location=(x,-z,0); root.rotation_euler.z=angle
        for mat,(vertices,faces) in self.batches.items():
            mesh=bpy.data.meshes.new(name+' '+mat); mesh.from_pydata(vertices,[],faces); mesh.update()
            obj=bpy.data.objects.new(mesh.name,mesh); bpy.context.collection.objects.link(obj)
            obj.parent=root; obj.data.materials.append(MATS[mat])
        return root

def pavilion(ratu,x,z,w,d,eave,shutters):
    b=Model(); base=4.2; upper=eave-10.4; arch_y=eave-5.7
    b.box(w,base,d,'granite',0,base/2,0)
    b.box(w,eave-base-.5,d,'limewash',0,(base+eave-.5)/2,0)
    for y,h,over in [(base,.24,.24),(base+.32,.16,.32),(eave-10.1,.23,.13),(eave-9.8,.13,.25),(eave-2.8,.22,.22),(eave-1.3,.36,.42),(eave-.66,.24,.55),(eave-.25,.22,.65)]:
        b.box(w+over,h,d+over,'trim' if y>base else 'granite',0,y,0)
    # Front/back each have two arched bays; the long façades have three.
    for side in range(4):
        r=side*math.pi/2; co,si=math.cos(r),math.sin(r)
        width,depth=(w,d) if side%2==0 else (d,w)
        def p(s,y,out=0): return (s*co+(depth/2+out)*si,y,-s*si+(depth/2+out)*co)
        def face_box(s,y,ww,hh,dd,mat,out=.05): b.box(ww,hh,dd,mat,*p(s,y,out),r)
        # Horizontal rustication and offset granite-block vertical joints.
        for row in range(6):
            y=.18+row*.68; face_box(0,y,width,.028,.02,'joint',.012)
            for i in range(-5,6):
                s=i*1.6+(row%2)*.8
                if abs(s)<width/2-.1: face_box(s,y+.34,.022,.64,.02,'joint',.013)
        for row in range(8): face_box(0,base+.6+row*.65,width,.018,.015,'granite',.01)
        bays=[-2.05,2.05] if side%2==0 else [-4.6,0,4.6]
        for s in [-width/2+.45,width/2-.45]:
            face_box(s,(base+eave-2.7)/2,.63,eave-2.7-base,.28,'trim',.13)
            for yy,ww,hh in [(base+.4,.92,.20),(eave-3.05,.9,.3),(eave-2.72,1.06,.24)]: face_box(s,yy,ww,hh,.4,'trim',.18)
            # Sculptural capitals are simplified leaf/volute silhouettes.
            for offset in [-.31,0,.31]: b.beam(p(s+offset,eave-3.1,.3),p(s+offset*.75,eave-2.65,.42),.10,'trim',6)
        for s in bays:
            ww,hh=1.95,5.2; bottom=arch_y-hh/2; spring=arch_y+hh/2-ww/2
            outline=[(-ww/2,bottom),(ww/2,bottom)]+[(math.cos(a)*ww/2,spring+math.sin(a)*ww/2) for a in [i*math.pi/24 for i in range(25)]]
            vertices=[p(s+xx,yy,.032) for xx,yy in outline]
            b.mesh('glass',vertices,[tuple(range(len(vertices)))])
            for sign in [-1,1]: face_box(s+sign*(ww/2+.14),(bottom+spring)/2,.18,spring-bottom,.25,'trim',.17)
            for i in range(24):
                a,c=i*math.pi/24,(i+1)*math.pi/24
                b.beam(p(s+math.cos(a)*(ww/2+.14),spring+math.sin(a)*(ww/2+.14),.20),p(s+math.cos(c)*(ww/2+.14),spring+math.sin(c)*(ww/2+.14),.20),.095,'trim',6)
            face_box(s,bottom-.16,ww+.55,.22,.42,'trim',.22)
            face_box(s,(bottom+spring)/2,.085,spring-bottom,.1,'trim',.13)
            if shutters:
                for j in range(18): face_box(s,bottom+.13+j*(spring-bottom-.2)/18,ww-.12,.095,.12,'shutter',.11)
            else:
                for j in range(1,8): face_box(s,bottom+j*(spring-bottom)/8,ww,.055,.1,'trim',.13)
                for off in [-.5,.5]: face_box(s+off,(bottom+spring)/2,.05,spring-bottom,.1,'trim',.13)
            for i in range(1,6):
                a=i*math.pi/6; b.beam(p(s,spring,.15),p(s+math.cos(a)*ww/2,spring+math.sin(a)*ww/2,.15),.035,'trim',5)
            # Lower rectangular windows occur on the long façades in references.
            if side%2:
                yy=(base+upper)/2+.35
                face_box(s,yy,.72,1.72,.035,'glass',.025)
                for off in [-.41,.41]: face_box(s+off,yy,.065,1.9,.14,'trim',.09)
                face_box(s,yy,.055,1.75,.12,'trim',.10);face_box(s,yy,.8,.055,.12,'trim',.10)
                face_box(s,yy-.93,.96,.1,.22,'trim',.13)
        # Dentils beneath the cornice, gutters and corner downpipes.
        for i in range(int(width/.32)): face_box(-width/2+.18+i*.32,eave-.82,.17,.18,.24,'trim',.25)
        for s in [-width/2+.06,width/2-.06]:
            b.beam(p(s,.2,.24),p(s,eave-.2,.24),.065,'shutter')
    # Copper ridge and triangular plaster pediments. No photos baked onto walls.
    ridge=eave+2.0; half=w/2+.38; length=d/2+.32
    b.mesh('copper',[(-half,eave,-length),(half,eave,-length),(0,ridge,-length),(-half,eave,length),(half,eave,length),(0,ridge,length)],[(0,3,5,2),(2,5,4,1)])
    for sign in [-1,1]:
        zz=sign*(d/2+.20)
        b.mesh('trim',[(-w/2,eave-.02,zz),(w/2,eave-.02,zz),(0,ridge-.10,zz)],[(0,1,2) if sign==1 else (2,1,0)])
        for edge in [-1,1]:
            b.beam((edge*half,eave,zz+.07*sign),(0,ridge,zz+.07*sign),.13,'trim')
            b.beam((edge*(half-.6),eave+.22,zz+.10*sign),(0,ridge-.32,zz+.10*sign),.045,'granite')
    for zz in [i*.65-length for i in range(int(2*length/.65)+1)]:
        for sign in [-1,1]: b.beam((0,ridge+.025,zz),(sign*half,eave+.025,zz),.019,'copper',5)
    root=b.finish(('West bell tower' if shutters else 'East chapel')+f' — RATU {ratu}',x,z,.052)
    root['ratu']=ratu;root['source']='Helsinki LOD2 envelope + Josefiina Alanen 2021 reference photographs (Wikimedia Commons)'
    root['accuracy']='Photo-guided architectural reconstruction; ornament dimensions approximate'

pavilion(212,-59.5457,17.9789,9.64,15.34,20.58,True)
pavilion(213,61.5103,12.2114,9.20,15.42,22.0,False)
os.makedirs(os.path.join(ROOT,'assets','source'),exist_ok=True)
os.makedirs(os.path.join(ROOT,'public','models'),exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','source','senate-pavilions.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','models','senate-pavilions.glb'),export_format='GLB',export_yup=True,export_extras=True)
print('Exported Senate Square pavilions: 14 material batches; photo-guided, not survey-exact.')
