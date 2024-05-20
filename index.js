import * as THREE from 'three';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { radixSort } from 'three/addons/utils/SortUtils.js';
import { BatchedInstancedMesh } from './src/BatchedInstancedMesh.js';
import { estimateBytesUsed } from 'three/addons/utils/BufferGeometryUtils.js';

let gui, infoEl;
let camera, controls, scene, renderer;
let geometries, mesh, material;
const ids = [];
const matrix = new THREE.Matrix4();

//

const position = new THREE.Vector3();
const rotation = new THREE.Euler();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();

//

const MAX_GEOMETRY_COUNT = 20000;

const api = {
    useInstances: true,

    count: 256,
    sortObjects: true,
    perObjectFrustumCulled: true,
    opacity: 1,
    useCustomSort: true,
};

init();
initGeometries();
initMesh();

//

function randomizeMatrix( matrix ) {

    position.x = Math.random() * 40 - 20;
    position.y = Math.random() * 40 - 20;
    position.z = Math.random() * 40 - 20;

    rotation.x = Math.random() * 2 * Math.PI;
    rotation.y = Math.random() * 2 * Math.PI;
    rotation.z = Math.random() * 2 * Math.PI;

    quaternion.setFromEuler( rotation );

    scale.x = scale.y = scale.z = 0.5 + ( Math.random() * 0.5 );

    return matrix.compose( position, quaternion, scale );

}

function randomizeRotationSpeed( rotation ) {

    rotation.x = Math.random() * 0.01;
    rotation.y = Math.random() * 0.01;
    rotation.z = Math.random() * 0.01;
    return rotation;

}

function initGeometries() {

    geometries = [
        new THREE.ConeGeometry( 1.0, 2.0 ),
        new THREE.BoxGeometry( 2.0, 2.0, 2.0 ),
        new THREE.SphereGeometry( 1.0, 16, 8 ),
    ];

}

function createMaterial() {

    if ( material ) {

        material.dispose();
        material = null;

    }

    material = new THREE.MeshNormalMaterial();

    const opacity = api.opacity;
    if ( opacity < 1 ) {

        material.transparent = true;
        material.depthWrite = false;

    } else {

        material.transparent = false;
        material.depthWrite = true;

    }

    material.opacity = opacity;

    return material;

}

function cleanup() {

    if ( mesh ) {

        mesh.parent.remove( mesh );

        if ( mesh.dispose ) {

            mesh.dispose();

        }

    }

}

function initMesh() {

    cleanup();

    const geometryCount = api.count;
    let vertexCount, indexCount, cons;
    if ( api.useInstances ) {

        vertexCount = 3 * 200;
        indexCount = 3 * 700;
        cons = BatchedInstancedMesh;

    } else {

        vertexCount = api.count * 200;
        indexCount = api.count * 700;
        cons = THREE.BatchedMesh;

    }

    const euler = new THREE.Euler();
    const matrix = new THREE.Matrix4();
    mesh = new cons( geometryCount, vertexCount, indexCount, createMaterial() );
    mesh.userData.rotationSpeeds = [];

    // disable full-object frustum culling since all of the objects can be dynamic.
    mesh.frustumCulled = false;

    ids.length = 0;

    for ( let i = 0; i < api.count; i ++ ) {

        let id;
        if ( i < geometries.length || ! api.useInstances ) {
        
            id = mesh.addGeometry( geometries[ i % geometries.length ] );

        } else {

            id = mesh.addInstance( i % geometries.length );

        }

        mesh.setMatrixAt( id, randomizeMatrix( matrix ) );

        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromEuler( randomizeRotationSpeed( euler ) );
        mesh.userData.rotationSpeeds.push( rotationMatrix );

        ids.push( id );

    }

    scene.add( mesh );

}

function init() {

    const width = window.innerWidth;
    const height = window.innerHeight;

    infoEl = document.getElementById( 'info' );

    // camera

    camera = new THREE.PerspectiveCamera( 70, width / height, 1, 1000 );
    camera.position.z = 30;

    // renderer

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( width, height );
    renderer.setAnimationLoop( animate );
    document.body.appendChild( renderer.domElement );

    // scene

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xffffff );

    // controls

    controls = new OrbitControls( camera, renderer.domElement );
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;

    // gui

    gui = new GUI();
    gui.add( api, 'useInstances' ).onChange( initMesh );
    gui.add( api, 'count', 1, MAX_GEOMETRY_COUNT ).step( 1 ).onChange( initMesh );
    gui.add( api, 'opacity', 0, 1 ).onChange( v => {

        if ( v < 1 ) {

            material.transparent = true;
            material.depthWrite = false;

        } else {

            material.transparent = false;
            material.depthWrite = true;

        }

        material.opacity = v;
        material.needsUpdate = true;

    } );
    gui.add( api, 'sortObjects' );
    gui.add( api, 'perObjectFrustumCulled' );
    gui.add( api, 'useCustomSort' );

    // listeners

    window.addEventListener( 'resize', onWindowResize );

}

//

function sortFunction( list ) {

    // initialize options
    this._options = this._options || {
        get: el => el.z,
        aux: new Array( this.maxGeometryCount )
    };

    const options = this._options;
    options.reversed = this.material.transparent;

    let minZ = Infinity;
    let maxZ = - Infinity;
    for ( let i = 0, l = list.length; i < l; i ++ ) {

        const z = list[ i ].z;
        if ( z > maxZ ) maxZ = z;
        if ( z < minZ ) minZ = z;

    }

    // convert depth to unsigned 32 bit range
    const depthDelta = maxZ - minZ;
    const factor = ( 2 ** 32 - 1 ) / depthDelta; // UINT32_MAX / z range
    for ( let i = 0, l = list.length; i < l; i ++ ) {

        list[ i ].z -= minZ;
        list[ i ].z *= factor;

    }

    // perform a fast-sort using the hybrid radix sort function
    radixSort( list, options );

}

function onWindowResize() {

    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize( width, height );

}

function animate() {

    animateMeshes();

    controls.update();

    render();

}

function animateMeshes() {

    for ( let i = 0; i < api.count; i ++ ) {

        const rotationMatrix = mesh.userData.rotationSpeeds[ i ];
        const id = ids[ i ];

        mesh.getMatrixAt( id, matrix );
        matrix.multiply( rotationMatrix );
        mesh.setMatrixAt( id, matrix );

    }

}

function getMemoryUsed( geometry ) {

    const unit = 'MB';
    const value = estimateBytesUsed( geometry ) * 1e-6;
    return parseFloat( value.toFixed( 3 ) ) + unit;

}

function render() {

    mesh.sortObjects = api.sortObjects;
    mesh.perObjectFrustumCulled = api.perObjectFrustumCulled;
    mesh.setCustomSort( api.useCustomSort ? sortFunction : null );

    renderer.render( scene, camera );

    infoEl.innerText = 
        `Draw Calls       : ${ renderer.info.render.calls }\n` +
        `Item Count       : ${ mesh instanceof THREE.BatchedMesh ? mesh._geometryCount : mesh._drawInfo.length }\n` +
        `Renderered Count : ${ mesh._multiDrawCount }\n` +
        `Geometry Count   : ${ mesh._geometryCount }\n` +
        `Geometry Size    : ~${ getMemoryUsed( mesh.geometry ) }`;

}