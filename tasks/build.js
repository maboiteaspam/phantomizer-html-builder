'use strict';

module.exports = function(grunt) {
    var _ = grunt.util._;

    grunt.registerTask("phantomizer-html-jitbuild", "Builds html inlined request", function ( target, request ) {

        var build_assets = true;

        var task_options = grunt.config("phantomizer-html-jitbuild");

        var options = {}
        grunt.util._.merge(options, task_options);

        if( !options[target] )
            options[target] = {
                options:{}
            }

        options[target]["options"]["request"] = request;
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

        var build_assets = options.build_assets;
        var htmlcompressor = options.htmlcompressor;

        var meta_manager = new meta_factory( wd, meta_dir )

        var current_target = this.target;

        var in_request = options.in_request;


        var in_request_tgt = in_request+"-"+current_target;
        var meta_file = meta_dir+"/"+in_request_tgt;
        var out_file = out_path+"/"+in_request_tgt;

        var sub_tasks = [];

        if( meta_manager.is_fresh(meta_file) == false ){

            // -
            queue_strykejs_builder( sub_tasks, current_target, in_request, in_request_tgt+".stryke", out_file+".stryke" );

            // -
            if( build_assets ){
                queue_html_assets( sub_tasks, current_target, in_request, out_file+".stryke", in_request_tgt+".assets", out_file+".assets", out_path, meta_dir );
            }

            // -
            if( htmlcompressor == true ){
                if( build_assets ){
                    queue_html_min(  sub_tasks, current_target, out_file+".min", meta_dir, in_request_tgt+".min", out_file+".assets", in_request );
                }else{
                    queue_html_min(  sub_tasks, current_target, out_file+".min", meta_dir, in_request_tgt+".min", out_file+".stryke", in_request );
                }
            }

            // -
            queue_finalizer_builder( sub_tasks, in_request_tgt, out_file, build_assets, htmlcompressor, meta_dir );

            // -
            grunt.task.run( sub_tasks );

            grunt.log.ok();
        }else{
            console.log("Build is fresh ! -> " + in_request)
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

        function queue_finalizer_builder( sub_tasks, in_request, out_file, build_assets, htmlcompressor, meta_dir ){

            var task_name = "phantomizer-finalizer";
            var opts = grunt.config(task_name) || {};
            var sub_task_name = "some-task"+"-"+sub_tasks.length;

            if( !opts[sub_task_name] )
                opts[sub_task_name] = {
                    options:{
                        copy:{}
                        ,meta_dir:meta_dir
                        ,meta_merge:{}
                    }
                };

            opts[sub_task_name].options.copy[out_file] = out_file+".stryke";
            opts[sub_task_name].options.meta_merge[in_request] = [in_request+".stryke"];
            if(build_assets){
                opts[sub_task_name].options.copy[out_file] = out_file+".assets";
                opts[sub_task_name].options.meta_merge[in_request].push(in_request+".assets");
            }
            if(htmlcompressor){
                opts[sub_task_name].options.copy[out_file] = out_file+".min";
                opts[sub_task_name].options.meta_merge[in_request].push(in_request+".min");
            }

            grunt.config.set(task_name, opts);
            sub_tasks.push( task_name+":"+sub_task_name );
        }
    });




    grunt.registerMultiTask("phantomizer-html-builder2", "Builds html request", function () {

        var path = require('path');

        var ph_libutil = require("phantomizer-libutil");
        var meta_factory = ph_libutil.meta;

        var sub_tasks = [];

        var options = this.options();

        grunt.verbose.writeflags(options,"options");
        var out_path = options.out_path;
        var meta_dir = options.meta_dir;
        var urls_file = options.urls_file;

        var build_assets = options.build_assets;
        var htmlcompressor = options.htmlcompressor;

        var meta_manager = new meta_factory( process.cwd(), meta_dir )

        var current_target = this.target;

        var raw_urls = grunt.file.readJSON(urls_file);
        grunt.log.ok("Reading urls from file "+urls_file);
        grunt.log.ok("URL Count "+raw_urls.length);

        var urls = [];
        for( var n in raw_urls ){
            var in_request = raw_urls[n];

            var in_request_tgt = in_request+"-"+current_target;
            var meta_file = in_request_tgt;
            var out_file = out_path+"/"+in_request;

            out_file = path.normalize(out_file);
            meta_file = path.normalize(meta_file);

            if( meta_manager.is_fresh(meta_file) == false ){
                urls.push({in_request:in_request,out_file:out_file,meta_file:meta_file})
            }
        }

        urls_file = "tmp/urls.json";
        grunt.file.mkdir("tmp");
        grunt.file.write(urls_file, JSON.stringify(urls));
        queue_strykejs_builder( sub_tasks, current_target, urls_file, meta_dir, out_path );

        for( var n in urls ){
            var in_request = urls[n].in_request;

            in_request_tgt = in_request+"-"+current_target;
            out_file = urls[n].out_file;

            // -
            if( build_assets ){
                queue_html_assets( sub_tasks, current_target, in_request, out_file, in_request_tgt, out_file, out_path, meta_dir );
            }
        }

        if( htmlcompressor == true ){
            queue_html_min_dir(  sub_tasks, current_target, meta_dir, out_path );
        }
        /*
         queue_gm_merge(sub_tasks, current_target, [out_path], out_path);
         queue_css_img_merge_dir(sub_tasks, current_target, meta_dir, [out_path], out_path);
         queue_img_opt_dir(sub_tasks, current_target, [out_path]);
         */

        function queue_strykejs_builder( sub_tasks, current_target, urls_file, meta_dir, out_dir ){

            var task_name = "phantomizer-strykejs-builder2";
            var opts = grunt.config(task_name) || {};
            var sub_task_name = current_target;

            opts = clone_subtasks_options(opts, sub_task_name, current_target);
            opts[sub_task_name].options.urls_file = urls_file;
            opts[sub_task_name].options.out_dir = out_dir;
            opts[sub_task_name].options.meta_dir = meta_dir;

            grunt.config.set(task_name, opts);
            sub_tasks.push( task_name+":"+sub_task_name );
        }

        // -
        grunt.task.run( sub_tasks );

        grunt.log.ok();

    });


    function queue_html_assets( sub_tasks, current_target, in_request, in_file, meta_file, out_file, out_path, meta_dir ){

        var task_name = "phantomizer-html-assets";
        var opts = grunt.config(task_name) || {};
        var sub_task_name = current_target+"-"+in_request;

        opts = clone_subtasks_options(opts, sub_task_name, current_target);
        opts[sub_task_name].options.in_file = in_file;
        opts[sub_task_name].options.real_current_target = current_target;
        opts[sub_task_name].options.out = out_file;
        opts[sub_task_name].options.meta_file = meta_file;
        opts[sub_task_name].options.out_path = out_path;
        opts[sub_task_name].options.meta_dir = meta_dir;
        opts[sub_task_name].options.in_request = in_request;

        grunt.config.set(task_name, opts)
        sub_tasks.push( task_name+":"+sub_task_name )
    }
    function queue_html_min( sub_tasks, current_target, out_file, meta_dir, meta_file, in_file, in_request ){

        var task_name = "phantomizer-htmlcompressor";
        var opts = grunt.config(task_name) || {};
        var sub_task_name = current_target+"-"+in_request;

        opts = clone_subtasks_options(opts, sub_task_name, current_target);
        opts[sub_task_name].options.in_file = in_file;
        opts[sub_task_name].options.out = out_file;
        opts[sub_task_name].options.meta_file = meta_file;
        opts[sub_task_name].options.meta_dir = meta_dir;

        grunt.config.set(task_name, opts);
        sub_tasks.push( task_name+":"+sub_task_name );
    }
    function queue_html_min_dir( sub_tasks, current_target, meta_dir, in_dir ){

        var task_name = "phantomizer-dir-htmlcompressor";
        var opts = grunt.config(task_name) || {};
        var sub_task_name = current_target+"-"+sub_tasks.length;

        opts = clone_subtasks_options(opts, sub_task_name, current_target);
        opts[sub_task_name].options.in_dir = in_dir+"/";
        opts[sub_task_name].options.meta_dir = meta_dir;

        grunt.config.set(task_name, opts);
        sub_tasks.push( task_name+":"+sub_task_name );
    }
    function queue_img_opt_dir( sub_tasks, current_target, paths ){
        var jit_target = "jit"+sub_tasks.length;
        var task_name = "phantomizer-dir-imgopt";
        var task_options = grunt.config(task_name) || {};

        task_options = clone_subtasks_options(task_options, jit_target, current_target);
        task_options[jit_target].options.paths = paths;

        sub_tasks.push( task_name+":"+jit_target );

        grunt.config.set(task_name, task_options);
    }
    function queue_css_img_merge_dir( sub_tasks, current_target, meta_dir, in_dir, out_dir ){
        var jit_target = "jit"+sub_tasks.length;
        var task_name = "phantomizer-dir-css-imgmerge";
        var task_options = grunt.config(task_name) || {};

        task_options = clone_subtasks_options(task_options, jit_target, current_target);
        task_options[jit_target].options.paths = in_dir;
        task_options[jit_target].options.out_dir = out_dir;
        task_options[jit_target].options.meta_dir = meta_dir;

        sub_tasks.push( task_name+":"+jit_target );

        grunt.config.set(task_name, task_options);
    }
    function queue_gm_merge( sub_tasks, current_target, paths, out_dir ){

        var jit_target = "jit"+sub_tasks.length;
        var task_name = "phantomizer-gm-merge";
        var task_options = grunt.config(task_name) || {};

        task_options = clone_subtasks_options(task_options, jit_target, current_target);

        if( !task_options[jit_target].options )
            task_options[jit_target].options = {};
        task_options[jit_target].options.paths = paths;
        task_options[jit_target].options.out_dir = out_dir;

        sub_tasks.push( task_name+":"+jit_target );

        grunt.config.set(task_name, task_options);
    }
    function clone_subtasks_options(task_options, task_name, current_target){
        var _ = grunt.util._;
        if( task_options[current_target] ) task_options[task_name] = _.clone(task_options[current_target], true);
        if( !task_options[task_name] ) task_options[task_name] = {};
        if( !task_options[task_name].options ) task_options[task_name].options = {};
        return task_options;
    }
};