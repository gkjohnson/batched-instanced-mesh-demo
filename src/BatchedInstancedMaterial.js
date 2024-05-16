export function onBeforeCompile( shader ) {

    shader.uniforms = {
        ...shader.uniforms,
        indirectTexture: { value: this.indirectTexture },
    };

    Object.defineProperty( this, 'indirectTexture', {

        set( v ) {
            
            shader.uniforms.indirectTexture.value = v;
        
        },
        get() {
            
            return shader.uniforms.indirectTexture.value;
        
        },

    } );

    shader.vertexShader = shader.vertexShader
        .replace(
            '#include <batching_pars_vertex>',
            /* glsl */`
                uniform usampler2D indirectTexture;
                float getIndirectIndex( const in int i ) {

                    // return float( i );
                    
                    int size = textureSize( indirectTexture, 0 ).x;
                    int x = i % size;
                    int y = i / size;
                    return float( texelFetch( indirectTexture, ivec2( x, y ), 0 ).r );

                }

                #include <batching_pars_vertex>
            `,
        )
        .replace(
            '#include <batching_vertex>',
            /* glsl */`
                float batchId = getIndirectIndex( gl_DrawID );
                #include <batching_vertex>
            `,
        );

};