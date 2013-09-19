
module.exports = function(grunt) {

    var d = __dirname+"/vendors/phantomizer-requirejs";

    var in_dir = d+"/demo/in/";
    var out_dir = d+"/demo/out/";
    var meta_dir = d+"/demo/out/";

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json')

        ,"out_dir":out_dir
        ,"meta_dir":meta_dir

        ,'phantomizer-html-builder': {
            options: {
                "out_path": "<%= out_dir %>/"
                ,"meta_path": "<%= meta_dir %>/"
                ,"paths":[in_dir]
                ,'phantomizer-html-assets': {
                    options: {
                        "requirejs_src":"/js/require-2.1.5-jquery-1.9.1.js",
                        "requirejs_baseUrl": "/js/",
                        "htmlcompressor": true,
                        "phantomizer-htmlcompressor":{
                            options: {
                                "compress-js":true,
                                "compress-css":true
                            }
                        },
                        "phantomizer-uglifyjs":{
                            banner: ''
                            ,beautify: false
                            ,report: false
                        }
                        ,"phantomizer-requirejs":{
                            "options":{
                                "baseUrl": in_dir+"/js"
                                ,"paths": {
                                    "almond": in_dir+"/js/almond-0.2.5"
                                    ,"jquery": in_dir+"/js/jquery-1.10.2.min"
                                }
                                ,"optimize": "none"
                                ,"wrap": true
                                ,"name": "almond"
                            }
                        }
                        ,"phantomizer-requirecss":{
                            "optimizeCss": "standard"
                        }
                    }
                }
                ,'phantomizer-strykejs-builder': {
                    options: {
                        "port":8080,
                        "ssl_port":8081
                    }
                }
            }
            ,test: {
                options:{
                    "in_request":"/index.html"
                    ,"out_file": "<%= out_dir %>/index.html"
                    ,"meta_file": "<%= meta_dir %>/index.html.meta"
                }
            }
        }
        //-
        ,'phantomizer-html-jitbuild': {
            options: {
                "out_path": "<%= out_dir %>/"
                ,"meta_path": "<%= meta_dir %>/"
                ,"paths":[in_dir]
                ,'phantomizer-html-assets': {
                    options: {
                        "requirejs_src":"/js/require-2.1.5-jquery-1.9.1.js"
                        ,"requirejs_baseUrl": "/js/"
                        ,"htmlcompressor": true
                        ,"phantomizer-htmlcompressor":{
                            options: {
                                "compress-js":true
                                ,"compress-css":true
                            }
                        }
                        ,"phantomizer-uglifyjs":{
                            banner: ''
                            ,beautify: false
                            ,report: false
                        }
                        ,"phantomizer-requirejs":{
                            "options":{
                                "baseUrl": in_dir+"/js"
                                ,"paths": {
                                    "almond": in_dir+"/js/almond-0.2.5"
                                    ,"jquery": in_dir+"/js/jquery-1.10.2.min"
                                }
                                ,"optimize": "uglify"

                                ,"wrap": true
                                ,"name": "almond"
                            }
                        }
                        ,"phantomizer-requirecss":{
                            "optimizeCss": "standard"
                        }
                    }
                }
                ,'phantomizer-strykejs-builder': {
                    options: {
                        "port":8080,
                        "ssl_port":8081
                    }
                }
            }
        }
    });

    grunt.loadNpmTasks('phantomizer-requirejs');
    grunt.loadNpmTasks('phantomizer-htmlcompressor');
    grunt.loadNpmTasks('phantomizer-strykejs');
    grunt.loadNpmTasks('phantomizer-uglifyjs');
    grunt.loadNpmTasks('phantomizer-html-assets');
    grunt.loadNpmTasks('phantomizer-html-builder');
    grunt.loadNpmTasks('phantomizer');

    grunt.registerTask('default',
        [
            'phantomizer-html-jitbuild:test:/index.html'
        ]);
};
