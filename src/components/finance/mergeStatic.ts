import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * دمج الأجسام الثابتة: كل الشبكات العادية تحت root ذات الخامة المتطابقة (بعد توحيد الخامات المتماثلة)
 * تصبح شبكة واحدة — من مئات/آلاف عمليات الرسم إلى عشرات. لا تمس الشبكات المتكررة (Instanced) ولا ما عليه keep أو تحته.
 * glow = خامات تتغير ليلًا: تبقى نفس الخامة المحفوظة (الموحدة) فيظل تغيير شدتها يعمل.
 */
const sig = (m: THREE.Material) => {
  const s = m as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial;
  return [m.type, m.name, s.color?.getHex(), s.roughness, s.metalness, s.emissive?.getHex(), s.emissiveIntensity, s.map?.uuid, s.emissiveMap?.uuid,
    m.transparent, m.opacity, m.side, m.alphaTest, m.depthWrite, m.blending, s.vertexColors, (s as { polygonOffset?: boolean }).polygonOffset].join('|');
};

export const mergeStatic = (root: THREE.Object3D, glow: [THREE.MeshStandardMaterial, number, number][] = []) => {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const canon = new Map<string, THREE.Material>();
  // الخامات المتغيرة ليلًا تُفضَّل كممثل لمجموعتها
  glow.forEach(([m]) => { const k = sig(m); if (!canon.has(k)) canon.set(k, m); });
  const groups = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean; order: number }>();
  const victims: THREE.Mesh[] = [];
  const kept = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) if (p.userData.keep) return true; return false; };
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || Array.isArray(o.material) || !o.visible || kept(o)) return;
    const k = sig(o.material);
    if (!canon.has(k)) canon.set(k, o.material);
    const mat = canon.get(k)!;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    // نفس الخصائص لكل الأجزاء (موضع، عمودي، إحداثيات خامة)
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    Object.keys(g.attributes).forEach(a => { if (a !== 'position' && a !== 'normal' && a !== 'uv') g.deleteAttribute(a); });
    g.morphAttributes = {};
    const e = groups.get(mat) ?? { geos: [], cast: false, receive: false, order: 0 };
    e.geos.push(g); e.cast ||= o.castShadow; e.receive ||= o.receiveShadow; e.order = Math.max(e.order, o.renderOrder);
    groups.set(mat, e);
    victims.push(o);
  });
  victims.forEach(o => { o.parent?.remove(o); o.geometry.dispose(); });
  const out: THREE.Mesh[] = [];
  groups.forEach((e, mat) => {
    const merged = mergeGeometries(e.geos, false);
    e.geos.forEach(g => g.dispose());
    if (!merged) return;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = e.cast; m.receiveShadow = e.receive; m.renderOrder = e.order;
    root.add(m); out.push(m);
  });
  return out;
};
