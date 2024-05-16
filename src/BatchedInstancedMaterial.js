export function onBeforeCompile( shader ) {

    console.log('GOT')
    shader.uniforms = {
        ...shader.uniforms,
        indirectTexture: { value: this.indirectTexture },
    };

    shader.vertexShader = shader.vertexShader
        .replace(
            '#include <batching_pars_vertex>',
            /* glsl */`
                uniform usampler2D indirectTexture;
                uint getIndirectIndex( const in float i ) {

                    int size = textureSize( indirectTexture, 0 ).x;
                    int j = int( i );
                    int x = j % size;
                    int y = j / size;
                    return texelFetch( indirectTexture, ivec2( x, y ), 0 ).r;

                }

                #include <batching_pars_vertex>
            `,
        )
        .replace(
            '#include <batching_vertex>',
            /* glsl */`

                #include <batching_vertex>
            `,
        );

};