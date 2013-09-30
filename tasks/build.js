'use strict';

module.exports = function(grunt) {

    grunt.registerTask("phantomizer-html-jitbuild", "Builds html inlined request", function ( target, request ) {

        var ph_libutil = require("phantomizer-libutil");
        var meta_factory = ph_libutil.meta;
        var router_facotry = ph_libutil.router;

        var config = grunt.config();

        var options = this.options();
        var out_path = options.out_path;
        var meta_dir = options.meta_dir;
        var build_assets = true;

        if( config.routing ){
            var router = new router_facotry(config.routing);
            var route = router.match(request);
            if( route ){
                if( route.urls && route.urls.indexOf(request) > -1 ){
                    build_assets = false;
                }
            }
        }

        var task_options = grunt.config("phantomizer-html-jitbuild");

        options = {}
        grunt.util._.merge(options, task_options);

        if( !options[target] )
            options[target] = {
                options:{}
            }

        options[target]["options"]["in_requests"] = [request];
        options[target]["options"]["build_assets"] = build_assets;

        grunt.config.set("phantomizer-html-builder", options);
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

        var build_assets = options.build_assets;
        var htmlcompressor = options.htmlcompressor;

        var meta_manager = new meta_factory( wd, meta_dir )

        var current_grunt_task = this.nameArgs;
        var current_target = this.target;

        //var in_request = options.in_request;
        var in_requests = options.in_requests;


        for( var k in in_requests ){
            var in_request = in_requests[k];
            var in_request_tgt = in_request+"-"+current_target;
            var meta_file = meta_dir+"/"+in_request_tgt;
            var out_file = out_path+"/"+in_request_tgt;

            var current_sub_task_name = "";
            var sub_tasks = [];

            if( meta_manager.is_fresh(meta_file) == false ){

                // -
                var in_file = ""
                for( var t in paths ){
                    if( grunt.file.exists(paths[t]+in_request) ){
                        in_file = paths[t]+in_request;
                        break;
                    }
                }

                // -
                queue_strykejs_builder( sub_tasks, current_target, in_request, in_request_tgt+".stryke", out_file+".stryke" );

                // -
                if( build_assets ){
                    queue_html_assets( sub_tasks, current_target, in_request, out_file+".stryke", in_request_tgt+".assets", out_file+".assets", out_path, meta_dir );
                }

                // -
                if( htmlcompressor == true ){
                    if( build_assets ){
                        queue_html_min(  sub_tasks, current_target, out_file+".min", meta_dir, in_request_tgt+".min", out_file+".assets" );
                    }else{
                        queue_html_min(  sub_tasks, current_target, out_file+".min", meta_dir, in_request_tgt+".min", out_file+".stryke" );
                    }
                }

                // -
                current_sub_task_name = "phantomizer-finalizer";
                var sub_task_name = "jit-builder"+sub_tasks.length;

                var opts = grunt.config(current_sub_task_name) || {}
                opts[sub_task_name] = {
                    options:{
                        copy:{}
                        ,meta_dir:meta_dir
                        ,meta_merge:{}
                    }
                }
                opts[sub_task_name].options.copy[out_file] = out_file+".stryke";
                opts[sub_task_name].options.meta_merge[in_request_tgt] = [in_request_tgt+".stryke"];
                if(build_assets){
                    opts[sub_task_name].options.copy[out_file] = out_file+".assets";
                    opts[sub_task_name].options.meta_merge[in_request_tgt].push(in_request_tgt+".assets");
                }
                if(htmlcompressor){
                    opts[sub_task_name].options.copy[out_file] = out_file+".min";
                    opts[sub_task_name].options.meta_merge[in_request_tgt].push(in_request_tgt+".min");
                }

                grunt.config.set(current_sub_task_name, opts);
                sub_tasks.push( current_sub_task_name+":"+sub_task_name );

                // -
                grunt.task.run( sub_tasks );

                grunt.log.ok();
            }else{
                console.log("Build is fresh ! -> " + in_request)
            }
        }

        // -- task queue-er
        function queue_strykejs_builder( sub_tasks, current_target, in_request, meta_file, out_file ){
            var current_sub_task_name = "phantomizer-strykejs-builder";
            var sub_task_name = in_request;
            var opts = grunt.config(current_sub_task_name) || {};
            if( opts[current_target] ) opts[sub_task_name] = _.clone(opts[current_target], true)
            if( !opts[sub_task_name] ) opts[sub_task_name] = {};
            if( !opts[sub_task_name].options ) opts[sub_task_name].options = {};
            opts[sub_task_name].options.in_request = in_request;
            opts[sub_task_name].options.out = out_file;
            opts[sub_task_name].options.meta = meta_file;

            grunt.config.set(current_sub_task_name, opts);
            sub_tasks.push( current_sub_task_name+":"+sub_task_name+":"+current_target );
        }
        function queue_html_assets( sub_tasks, current_target, in_request, in_file, meta_file, out_file, out_path, meta_dir ){
            var current_sub_task_name = "phantomizer-html-assets";
            var sub_task_name = current_target;

            var opts = grunt.config(current_sub_task_name) || {};
            if( opts[current_target] ) opts[sub_task_name] = _.clone(opts[current_target], true);
            if( !opts[sub_task_name] ) opts[sub_task_name] = {};
            if( !opts[sub_task_name].options ) opts[sub_task_name].options = {};
            opts[sub_task_name].options.in_file = in_file;
            opts[sub_task_name].options.out = out_file;
            opts[sub_task_name].options.meta_file = meta_file;
            opts[sub_task_name].options.out_path = out_path;
            opts[sub_task_name].options.meta_dir = meta_dir;
            opts[sub_task_name].options.in_request = in_request;

            grunt.config.set(current_sub_task_name, opts)
            sub_tasks.push( current_sub_task_name+":"+sub_task_name )
        }
        function queue_html_min( sub_tasks, current_target, out_file, meta_dir, meta_file, in_file ){

            var jit_target = "jit"+sub_tasks.length;
            var task_name = "phantomizer-htmlcompressor";
            var task_options = grunt.config(task_name) || {};

            task_options = clone_subtasks_options(task_options, jit_target, current_target)
            task_options[jit_target].options.in_file = in_file;
            task_options[jit_target].options.out = out_file;
            task_options[jit_target].options.meta_file = meta_file;
            task_options[jit_target].options.meta_dir = meta_dir;

            grunt.config.set(task_name, task_options);
            sub_tasks.push( task_name+":"+jit_target );
        }
        function clone_subtasks_options(task_options, task_name, current_target){
            var _ = grunt.util._;
            if( task_options[current_target] ) task_options[task_name] = _.clone(task_options[current_target], true);
            if( !task_options[task_name] ) task_options[task_name] = {};
            if( !task_options[task_name].options ) task_options[task_name].options = {};
            return task_options;
        }
    });
};