'use strict';

module.exports = function(grunt) {

    grunt.registerTask("phantomizer-html-jitbuild", "Builds html inlined request", function ( target, request ) {

        var options = this.options();
        var out_path = options.out_path;
        var meta_dir = options.meta_dir;


        var task_options = grunt.config("phantomizer-html-jitbuild");

        options = {}
        grunt.util._.merge(options, task_options);

        if( !options[target] )
            options[target] = {
                options:{}
            }

        options[target]["options"]["in_request"] = request
        options[target]["options"]["out_file"] = out_path+request
        options[target]["options"]["meta_file"] = request+".meta"

        grunt.config.set("phantomizer-html-builder", options)
        grunt.task.run("phantomizer-html-builder:" + target);

    });

    grunt.registerMultiTask("phantomizer-html-builder", "Builds html request", function () {

        var _ = grunt.util._;
        var path = require('path');

        var ph_libutil = require("phantomizer-libutil");
        var meta_factory = ph_libutil.meta;

        var wd = process.cwd();

        var options = this.options();
        grunt.verbose.writeflags(options,"options");
        var out_path = options.out_path;
        var meta_dir = options.meta_dir;
        var paths = options.paths;
        var in_request = options.in_request;

        var meta_file = options.meta_file;
        var out_file = options.out_file;

        var meta_manager = new meta_factory( wd, meta_dir )
        var deps = []

        var current_sub_task_name = ""
        var sub_tasks = []

        var current_grunt_task = this.nameArgs
        var current_target = this.target

        if( !meta_file ){
            grunt.log.error("missing option property meta_file")
        }else if( meta_manager.is_fresh(meta_file) == false ){

            // -
            var in_file = ""
            for( var t in paths ){
                if( grunt.file.exists(paths[t]+in_file) ){
                    in_file = paths[t]+in_file;
                    break;
                }
            }
            deps.push(in_file)

            if ( grunt.file.exists(process.cwd()+"/Gruntfile.js")) {
                deps.push(process.cwd()+"/Gruntfile.js")
            }
            deps.push(__filename)

            // -
            current_sub_task_name = "phantomizer-strykejs-builder";
            var sub_task_name = in_request;
            var opts = grunt.config(current_sub_task_name) || {};
            if( opts[current_target] ) opts[sub_task_name] = _.clone(opts[current_target], true)
            if( !opts[sub_task_name] ) opts[sub_task_name] = {};
            if( !opts[sub_task_name].options ) opts[sub_task_name].options = {};
            opts[sub_task_name].options.in_request = in_request;
            opts[sub_task_name].options.out = out_file+".stryke";
            opts[sub_task_name].options.meta = meta_file+".stryke";

            grunt.config.set(current_sub_task_name, opts);
            sub_tasks.push( current_sub_task_name+":"+sub_task_name+":"+current_target );





            // -
            current_sub_task_name = "phantomizer-html-assets";
            sub_task_name = current_target;

            opts = grunt.config(current_sub_task_name) || {};
            if( opts[current_target] ) opts[sub_task_name] = _.clone(opts[current_target], true);
            if( !opts[sub_task_name] ) opts[sub_task_name] = {};
            if( !opts[sub_task_name].options ) opts[sub_task_name].options = {};
            opts[sub_task_name].options.in_file = out_file+".stryke";
            opts[sub_task_name].options.out = out_file+".assets";
            opts[sub_task_name].options.meta_file = meta_file+".assets";
            opts[sub_task_name].options.out_path = out_path;
            opts[sub_task_name].options.meta_dir = meta_dir;
            opts[sub_task_name].options.in_request = in_request;

            grunt.config.set(current_sub_task_name, opts)
            sub_tasks.push( current_sub_task_name+":"+sub_task_name )




            // -
            current_sub_task_name = "phantomizer-finalizer"
            sub_task_name = "jit"+sub_tasks.length;

            opts = grunt.config(current_sub_task_name) || {}
            opts[sub_task_name] = {
                options:{
                    copy:{}
                    ,meta_dir:meta_dir
                    ,meta_merge:{}
                }
            }
            opts[sub_task_name].options.copy[out_file] = out_file+".assets";
            opts[sub_task_name].options.meta_merge[meta_file] = [meta_file+".stryke", meta_file+".assets"];

            grunt.config.set(current_sub_task_name, opts);
            sub_tasks.push( current_sub_task_name+":"+sub_task_name );

            // -
            grunt.task.run( sub_tasks );

            grunt.log.ok();
        }else{
            console.log("your build is fresh !")
        }
    });
};