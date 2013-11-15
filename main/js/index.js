jQuery(document).ready(function(){ 

    var options = {};

    // *NB* Modify your url and credentials here
    options.url = 'http://localhost:8880/zabbix/api_jsonrpc_jsonp.php';
    options.username = 'Admin';
    options.password = 'zabbix';

    // make jqzabbix object
    var server = new $.jqzabbix(options);
    
    // user authentication
    server.userLogin(
        null,
        function() {
            $("#user").html("You are logged in as: " + options.username + "<br />AuthID: " + server.getAuthId());
            afterLoggedIn();
        },
        errorMethod);
    
    // for the form submission
    $('#theform').on('submit', function(e){
        e.preventDefault();
        var method = $('#method').val();
        var params = {};
        $("#param_table tr").each(function(){
            if ($(this).find(".key") && $(this).find(".value")) {
                the_key = $(this).find(".key").eq(0).val();
                the_value = $(this).find(".value").eq(0).val();
            }
            if (the_key && the_value) {
                params[the_key] = the_value;
            }
        });
        server.sendAjaxRequest(
            method,
            params, 
            successMethod,
            errorMethod);
    });

    // for the params
    $('#add_param').click(function(){
        empty_row = '<tr><td><input class="key" type="text" /></td><td><input class="value" type="text" /></td>' +
        '<td><input type="button" value="Delete" onClick="$(this).closest(\'tr\').remove();"></td><tr>';
        $('#param_table tr:last').after(empty_row);
    });

    var successMethod = function(response, status) {
        // response is string
        if (typeof(response.result) === 'string' || typeof(response.result) === 'boolean') {
            $('#result').html('<p>'+ response.result +'</p>')
        }

        // response is object 
        else if (typeof(response.result) === 'object') {
            num = 0; // for table header
            var header = '';
            var row = '';
            var contents = '';

            // each data
            $.each(response.result, function() {
                row = '';
                $.each(this, function(key, value) {
                    if (num === 0) { header += '<th>' + key + '</th>'; };
                    if (typeof value === 'object') {
                        row += '<td>' + JSON.stringify(value) + '</td>'
                    }
                    else {
                        row += '<td>' + value + '</td>';
                    }
                });
                if (num === 0) {
                    header = '<tr>' + header + '</tr>';
                }
                contents += '<tr>' + row + '</tr>'
                    num++;
            });

            if (contents) {
                $('#result').html('<p>Result Length: '+ response.result.length + '</p><table>' + header + contents + '</table>');
            }
            else {
                $('#result').html('No result')
            }
        }
    }

    var errorMethod = function() {
        var errormsg = '';
        $.each(server.isError(), function(key, value) {
            errormsg += '<li>' + key + ' : ' + value + '</li>';
        });
        $('#error').html('<ul>' + errormsg + '</ul>');
    }

    var afterLoggedIn = function() {
        // get host names
        server.sendAjaxRequest(
            "host.get",
            {"output": "extend"},
            afterGetHosts,
            errorMethod);
    }

    var hosts = {};
    var afterGetHosts = function(response, status){
        // get host names
        _.each(response.result, function(the_host_item){
            hosts[the_host_item['hostid']] = the_host_item['name'];
        });
        // make charts
        server.sendAjaxRequest(
            "item.get",
            {"output": "extend", "monitored": "true"}, 
            makeCharts,
            errorMethod);
    }

    var makeCharts = function(response, status) {
        // get graph data
        all_data = _.groupBy(response.result, function(item){
            return item['hostid'];
        });

        // extract data for different graphs
        available_memories = {};
        uptimes = {};
        free_disk_spaces = {};
        agent_pings = {};
        cpu_idle_times = {};
        cpu_system_times = {};
        cpu_user_times = {};
        _.each(all_data, function(item_data_list, the_host_name){
            _.each(item_data_list, function(item_data){
                if (item_data['key_'] === 'agent.ping') {
                    agent_pings[the_host_name] = item_data['lastvalue'];
                }
                if (item_data['key_'] === 'vm.memory.size[available]') {
                    available_memories[the_host_name] = item_data['lastvalue']/1024/1024;
                }
                if (item_data['key_'] === 'system.uptime') {
                    uptimes[the_host_name] = item_data['lastvalue']/60/60;
                }
                if (item_data['key_'] === 'vfs.fs.size[/,free]') {
                    free_disk_spaces[the_host_name] = item_data['lastvalue']/1024/1024;
                }
                if (item_data['key_'] === 'system.cpu.util[,idle]') {
                    cpu_idle_times[the_host_name] = item_data['lastvalue']/1;
                }
                if (item_data['key_'] === 'system.cpu.util[,system]') {
                    cpu_system_times[the_host_name] = item_data['lastvalue']/1;
                }
                if (item_data['key_'] === 'system.cpu.util[,user]') {
                    cpu_user_times[the_host_name] = item_data['lastvalue']/1;
                }
            });
        });

        // fill in the table for host status
        data_sys_status = {};
        _.each(agent_pings, function(hostid, statusid){
            if (statusid === 1) {
                status = 'up';
            } else {
                status = 'down'
            }
            data_sys_status[hosts[hostid]] = status;
        });

        // make graph for available memories
        var chart_data_avail_mem = makeLineChartData(available_memories, hosts);
        makeLineChart("chart_available_memory", chart_data_avail_mem);

        // make graph for system uptime
        var chart_data_sys_uptime = makeLineChartData(uptimes, hosts);
        makeLineChart("chart_system_uptime", chart_data_sys_uptime);

        // make graph for free disk space on /
        var chart_data_free_disk_space = makeLineChartData(free_disk_spaces, hosts);
        makeLineChart("chart_free_disk_space", chart_data_free_disk_space);

        // make graph for CPU idle time
        var chart_data_cpu_idle_time = makeLineChartData(cpu_idle_times, hosts);
        makeLineChart("chart_cpu_idle_time", chart_data_cpu_idle_time);

        // make graph for CPU system time
        var chart_data_cpu_system_time = makeLineChartData(cpu_system_times, hosts);
        makeLineChart("chart_cpu_system_time", chart_data_cpu_system_time);

        // make graph for CPU user time
        var chart_data_cpu_user_time = makeLineChartData(cpu_user_times, hosts);
        makeLineChart("chart_cpu_user_time", chart_data_cpu_user_time);

    }

    var makeLineChartData = function(data_with_hostid, hosts) {
        labels = [];
        datasets = [];
        _.each(_.keys(data_with_hostid), function(hostid){
            labels.push(hosts[hostid]);
        });
        datasets.push({data: _.values(data_with_hostid),
            fillColor : "rgba(151,187,205,0.5)",
            strokeColor : "rgba(151,187,205,1)",});
        return {"labels": labels, "datasets": datasets};
    }

    var makeLineChart = function(canvas_id, chart_data) {
        chart_ctx = $("#" + canvas_id).get(0).getContext("2d");
        return new Chart(chart_ctx).Bar(chart_data);
    }

});

