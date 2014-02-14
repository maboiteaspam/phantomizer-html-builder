'use strict';

module.exports = function(grunt) {
  var _ = grunt.util._;
  var path = require('path');

  var ph_libutil = require("phantomizer-libutil");

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

    var options = this.options({
      out_path:'',
      htmlcompressor:false,
      build_assets:false,
      in_request:''
    });

    grunt.verbose.writeflags(options,"options");
    var out_path = options.out_path;

    var build_assets = options.build_assets;
    var htmlcompressor = options.htmlcompressor;
    var in_request = options.in_request;

    var current_target = this.target;

    var in_request_tgt = in_request+"-"+current_target;
    var out_file = out_path+"/"+in_request_tgt;

    var sub_tasks = [];


// get phantomizer main instance
    var phantomizer = ph_libutil.get("main");
    var meta_manager = phantomizer.get_meta_manager();

    if( meta_manager.is_fresh(in_request_tgt) == false ){

      // -
      queue_strykejs_builder( sub_tasks, current_target, in_request, in_request_tgt+".stryke", out_file+".stryke" );
      grunt.log.ok("Stryke task pushed ");

      // -
      if( build_assets ){
        queue_html_assets( sub_tasks, current_target, in_request, out_file+".stryke", in_request_tgt+".assets", out_file+".assets", out_path );
        grunt.log.ok("assets build task pushed ");
      }

      // -
      if( htmlcompressor == true ){
        if( build_assets ){
          queue_html_min(  sub_tasks, current_target, out_file+".min", in_request_tgt+".min", out_file+".assets", in_request );
        }else{
          queue_html_min(  sub_tasks, current_target, out_file+".min", in_request_tgt+".min", out_file+".stryke", in_request );
        }
        grunt.log.ok("HTMLcompressor task pushed ");
      }

      // -
      queue_finalizer_builder( sub_tasks, in_request_tgt, out_file, build_assets, htmlcompressor );
      grunt.log.ok("Finalizer task pushed ");

      // -
      grunt.task.run( sub_tasks );

      grunt.log.ok("Done ");
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

    function queue_finalizer_builder( sub_tasks, in_request, out_file, build_assets, htmlcompressor ){

      var task_name = "phantomizer-finalizer";
      var opts = grunt.config(task_name) || {};
      var sub_task_name = "some-task"+"-"+sub_tasks.length;

      if( !opts[sub_task_name] )
        opts[sub_task_name] = {
          options:{
            copy:{}
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



  // Builds a phantomizer project
  // ----------
  grunt.registerMultiTask("phantomizer-html-project-builder",
    "Builds an entire project with best performance", function () {

      // this task is async
      var done = this.async();

      var sub_tasks = [];

      // init default options
      var options = this.options({
        // the path were all build assets results
        out_path:'',
        // the path holding all build assets meta
        // the path to record temporarly url collection
        run_dir:'',
        // the path used for webserver
        paths:[],
        // enable extras support scripts injection (dashbaord loader, test loader)
        inject_extras:false,
        // enable js,css,img build
        build_assets:false
      });
      grunt.verbose.writeflags(options,"options");

      var current_target = this.target;

      var phantomizer = ph_libutil.get("main");
      var meta_manager = phantomizer.get_meta_manager();

      // initialize the router given the grunt config.routing key
      // router provides the catalog of urls to build
      var router = phantomizer.get_router();
      // load urls eventually from a remote service
      router.load(function(){

        // fetch urls to build
        var not_added = [];
        var raw_urls = router.collect_urls(function(route){
          if( route.export == false ){
            not_added.push(route);
            return false;
          }
          return true;
        });
        grunt.log.ok("URL to export: "+raw_urls.length+"/"+(raw_urls.length+not_added.length));

        var in_request;
        var in_request_tgt;
        var urls = [];
        for( var n in raw_urls ){
          in_request = raw_urls[n];

          in_request_tgt = in_request+"-"+current_target;
          var meta_file = in_request_tgt;
          var out_file = options.out_path+"/"+in_request;

          out_file = path.normalize(out_file);
          meta_file = path.normalize(meta_file);

          if( meta_manager.is_fresh(meta_file) == false ){
            urls.push({
              raw_in_request:raw_urls[n], /* is exported for html-project-assets builder */
              in_file:out_file, /* is exported for html-project-assets builder */
              in_request:in_request,
              out_file:out_file,
              meta_file:meta_file
            });
          }
        }

        var urls_file = options.run_dir+"/tmp/html-builder-urls.json";
        grunt.file.mkdir( path.dirname(urls_file) );
        grunt.file.write(urls_file, JSON.stringify(urls));

        queue_strykejs_builder( sub_tasks, current_target, urls_file, options.inject_extras );

        if( options.build_assets ){
          queue_html_project_assets( sub_tasks, current_target, urls_file, options.out_path );
        }
        // helps to prevent odd error such :
        // Warning: Maximum call stack size exceeded Use --force to continue.
        sub_tasks.push( "throttle:20" );

        if( options.inject_extras == true ){
          queue_html_inject_extras_dir(  sub_tasks, current_target, options.out_path );
        }

        if( options.build_assets ){
          queue_gm_merge(sub_tasks, current_target, options.paths, options.out_path);
        }
        queue_img_opt_dir(sub_tasks, current_target, options.paths, options.out_path);

        if( options.build_assets ){
          queue_css_img_merge_dir(sub_tasks, current_target, options.out_path, options.out_path);
        }
        // -
        grunt.task.run( sub_tasks );
        grunt.log.ok();

        done();
      });

      function queue_strykejs_builder( sub_tasks, sub_task_name, urls_file, inject_extras ){

        var task_name = "phantomizer-strykejs-project-builder";
        var opts = grunt.config(task_name) || {};

        opts = clone_subtasks_options(opts, sub_task_name, current_target);
        opts[sub_task_name].options.urls_file = urls_file;
        opts[sub_task_name].options.inject_extras = inject_extras;

        grunt.config.set(task_name, opts);
        sub_tasks.push( task_name+":"+sub_task_name );
      }

      function queue_html_project_assets( sub_tasks, current_target, urls_file, out_path ){

        var task_name = "phantomizer-html-project-assets";
        var opts = grunt.config(task_name) || {};
        var sub_task_name = task_name+"-"+current_target;

        opts = clone_subtasks_options(opts, sub_task_name, current_target);
        opts[sub_task_name].options.urls_file = urls_file;
        opts[sub_task_name].options.as_of_target = current_target;
        opts[sub_task_name].options.out_path = out_path;

        grunt.config.set(task_name, opts)
        sub_tasks.push( task_name+":"+sub_task_name )
      }
    });


  function queue_html_assets( sub_tasks, current_target, in_request, in_file, meta_file, out_file, out_path ){

    var task_name = "phantomizer-html-assets";
    var opts = grunt.config(task_name) || {};
    var sub_task_name = in_request+"-"+current_target;

    opts = clone_subtasks_options(opts, sub_task_name, current_target);
    opts[sub_task_name].options.in_file = in_file;
    opts[sub_task_name].options.as_of_target = current_target;
    opts[sub_task_name].options.out = out_file;
    opts[sub_task_name].options.meta_file = meta_file;
    opts[sub_task_name].options.out_path = out_path;
    opts[sub_task_name].options.in_request = in_request;

    grunt.config.set(task_name, opts)
    sub_tasks.push( task_name+":"+sub_task_name )
  }
  function queue_html_min( sub_tasks, current_target, out_file, meta_file, in_file, in_request ){

    var task_name = "phantomizer-htmlcompressor";
    var opts = grunt.config(task_name) || {};
    var sub_task_name = current_target+"-"+in_request;

    opts = clone_subtasks_options(opts, sub_task_name, current_target);
    opts[sub_task_name].options.in_file = in_file;
    opts[sub_task_name].options.out = out_file;
    opts[sub_task_name].options.meta_file = meta_file;

    grunt.config.set(task_name, opts);
    sub_tasks.push( task_name+":"+sub_task_name );
  }
  function queue_html_inject_extras_dir( sub_tasks, current_target, in_dir ){

    var task_name = "phantomizer-dir-inject-html-extras";
    var opts = grunt.config(task_name) || {};
    var sub_task_name = current_target+"-"+sub_tasks.length;

    opts = clone_subtasks_options(opts, sub_task_name, current_target);
    opts[sub_task_name].options.in_dir = in_dir+"/";

    grunt.config.set(task_name, opts);
    sub_tasks.push( task_name+":"+sub_task_name );
  }

  function queue_img_opt_dir( sub_tasks, build_target, paths, out_path ){

    var jit_target = ""+build_target;
    var task_name = "phantomizer-dir-imgopt";
    var task_options = grunt.config(task_name) || {};

    task_options = clone_subtasks_options(task_options, jit_target, build_target);
    if(!task_options[jit_target].options) task_options[jit_target].options = {};
    task_options[jit_target].options.paths = paths;
    task_options[jit_target].options.out_path = out_path;

    sub_tasks.push( task_name+":"+jit_target );

    grunt.config.set(task_name, task_options);
  }
  function queue_css_img_merge_dir( sub_tasks, build_target, in_dir, out_dir ){

    var merge_options = grunt.config("phantomizer-gm-merge") || {};
    var map = merge_options.options.in_files;

    var jit_target = ""+build_target;
    var task_name = "phantomizer-dir-css-imgmerge";
    var task_options = grunt.config(task_name) || {};

    task_options = clone_subtasks_options(task_options, jit_target, build_target);
    task_options[jit_target].options.paths = in_dir;
    task_options[jit_target].options.out_dir = out_dir;
    task_options[jit_target].options.map = map;

    sub_tasks.push( task_name+":"+jit_target );

    grunt.config.set(task_name, task_options);
  }
  function queue_gm_merge( sub_tasks, build_target, paths, out_dir ){

    var jit_target = ""+build_target;
    var task_name = "phantomizer-gm-merge";
    var task_options = grunt.config(task_name) || {};

    task_options = clone_subtasks_options(task_options, jit_target, build_target);

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