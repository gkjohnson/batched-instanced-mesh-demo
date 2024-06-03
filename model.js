
import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { estimateBytesUsed } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';

const ENV_URL = 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/leadenhall_market_1k.hdr';
const GLTF_URL = 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/models/dungeon-warkarma/scene.gltf';
let camera, scene, renderer, infoEl;
let model, batchedMesh;
let rollingFrameTime = 0;
let totalFrames = 0;
let totalInstances = 0;
let totalMeshes = 0;
let sharedGeometries = 0;

const params = {
    'BatchedMesh': true,
    'sortObjects': true,
    'perObjectFrustumCulled': true,
};

init();

export function bufferToHash( buffer ) {

    let hash = 0;
    if ( buffer.byteLength !== 0 ) {

        let uintArray;
        if ( buffer.buffer ) {

            uintArray = new Uint8Array( buffer.buffer, buffer.byteOffset, buffer.byteLength );

        } else {

            uintArray = new Uint8Array( buffer );

        }

        for ( let i = 0; i < buffer.byteLength; i ++ ) {

            const byte = uintArray[ i ];
            hash = ( ( hash << 5 ) - hash ) + byte;
            hash |= 0;

        }

    }

    return hash;

}

async function init() {

    infoEl = document.getElementById( 'info' );

    const container = document.createElement( 'div' );
    document.body.appendChild( container );

    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 2, 5000 );
    camera.position.set( 625.5493586247832, 634.0971757261962, 672.2199263993684 );

    scene = new THREE.Scene();

    const texture = await new RGBELoader().loadAsync( ENV_URL );
    texture.mapping = THREE.EquirectangularReflectionMapping;

    scene.background = texture;
    scene.environment = texture;
    scene.backgroundBlurriness = 0.5;

    // model

    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync( GLTF_URL );
    model = gltf.scene;

    model.scale.setScalar( 0.1 );
    model.updateMatrixWorld( true );

    const box = new THREE.Box3();
    box.setFromObject( model );
    box.getCenter( model.position ).multiplyScalar( - 1 );

    batchedMesh = new THREE.BatchedMesh( 1000, 35000, 55000, new THREE.MeshStandardMaterial() );
    const count = {};
    const idMap = {};

    let totalIndex = 0;
    let totalVerts = 0;
    model.updateMatrixWorld( true );
    model.traverse( c => {

        if ( c.isMesh ) {

            const hash = `${ bufferToHash( c.geometry.index.array ) }_${ bufferToHash( c.geometry.attributes.position.array ) }`;
            count[ hash ] = count[ hash ] || 0;
            count[ hash ] ++;

            totalMeshes ++;

            if ( ! ( hash in idMap ) ) {

                idMap[ hash ] = batchedMesh.addGeometry( c.geometry );

                totalVerts += c.geometry.attributes.position.count;
                totalIndex += c.geometry.index.count;

            }

            const instanceId = batchedMesh.addInstance( idMap[ hash ] );

            batchedMesh.setMatrixAt( instanceId, c.matrixWorld );
            batchedMesh.setColorAt( instanceId, c.material.color );

        }

    } );

    const dupes = Object.values( count ).sort();
    totalInstances = dupes.filter( d => d > 1 ).reduce( ( acc, v ) => acc + v, 0 );
    sharedGeometries = dupes.filter( d => d > 1 ).length;

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    container.appendChild( renderer.domElement );

    const controls = new OrbitControls( camera, renderer.domElement );
    controls.target.set( 0, 0, - 0.2 );
    controls.update();

    const gui = new GUI();
    gui.add( params, 'BatchedMesh' );
    gui.add( params, 'sortObjects' );
    gui.add( params, 'perObjectFrustumCulled' );

    onWindowResize();

    render();

    window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

//

function render() {

    requestAnimationFrame( render );

    scene.remove( model, batchedMesh );
    if ( params.BatchedMesh ) {

        batchedMesh.perObjectFrustumCulled = params.perObjectFrustumCulled;
        batchedMesh.sortObjects = params.sortObjects;
        scene.add( batchedMesh );

    } else {

        scene.add( model );

    }

    const start = window.performance.now();

    renderer.render( scene, camera );

    const delta = window.performance.now() - start;

    if ( totalFrames < 30 ) totalFrames ++;
    rollingFrameTime += ( delta - rollingFrameTime ) / totalFrames;

    let bytes = 0;
    scene.traverse( c => {

        if ( c.geometry ) {

            bytes += estimateBytesUsed( c.geometry );

        }

    } );

    infoEl.innerText =
        `Draw Calls              : ${ renderer.info.render.calls }\n` +
        `Total Meshes            : ${ totalMeshes }\n` +
        `Total Instances         : ${ totalInstances }\n` +
        `Total Shared Geometries : ${ sharedGeometries }\n` +
        `Drawn Instances         : ${ params.BatchedMesh ? batchedMesh._multiDrawCount : '--' }\n` +
        `Geometry Memory         : ${ ( bytes * 1e-6 ).toFixed( 2 ) }MB\n` +
        `Frame Time              : ${ rollingFrameTime.toFixed( 2 ) }ms\n`;

}

