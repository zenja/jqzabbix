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

    // for the console params
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
                $('#result').html('<p>Result Length: '+ response.result.length + '</p><table border="1">' + header + contents + '</table>');
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

        // extract data for different statistics
        available_memories = {};
        uptimes = {};
        free_disk_spaces = {};
        agent_pings = {};
        cpu_idle_times = {};
        cpu_system_times = {};
        cpu_user_times = {};
        cpu_iowait_times = {};
        loggedin_user_nums = {};
        system_unames = {};
        temperatures = {}; // key: host id; value[0]: host name; value[1]: description; value[2]: temperature
        tmp_id = 0;
        _.each(all_data, function(item_data_list, the_host_id){
            _.each(item_data_list, function(item_data){
                if (item_data['key_'] === 'agent.ping') {
                    agent_pings[the_host_id] = item_data['lastvalue'];
                }
                if (item_data['key_'] === 'vm.memory.size[available]') {
                    available_memories[the_host_id] = item_data['lastvalue']/1024/1024;
                }
                if (item_data['key_'] === 'system.uptime') {
                    uptimes[the_host_id] = item_data['lastvalue']/60/60;
                }
                if (item_data['key_'] === 'vfs.fs.size[/,free]') {
                    free_disk_spaces[the_host_id] = item_data['lastvalue']/1024/1024;
                }
                if (item_data['key_'] === 'system.cpu.util[,idle]') {
                    cpu_idle_times[the_host_id] = item_data['lastvalue']/1;
                }
                if (item_data['key_'] === 'system.cpu.util[,system]') {
                    cpu_system_times[the_host_id] = item_data['lastvalue']/1;
                }
                if (item_data['key_'] === 'system.cpu.util[,user]') {
                    cpu_user_times[the_host_id] = item_data['lastvalue']/1;
                }
                if (item_data['key_'] === 'system.cpu.util[,iowait]') {
                    cpu_iowait_times[the_host_id] = item_data['lastvalue']/1;
                }
                if (item_data['key_'] === 'system.users.num') {
                    loggedin_user_nums[the_host_id] = item_data['lastvalue']/1;
                }
                if (item_data['key_'] === 'system.uname') {
                    system_unames[the_host_id] = item_data['lastvalue'];
                }
                // temperature is special, its key is a id and it is not used
                // and its value is an array: [<hostname>, <description>, <temperature>]
                // and temperature is not a standard zabbix matrix
                if (item_data['key_'].indexOf('temp') === 0 && item_data['lastvalue'] != 0) {
                    temperatures[tmp_id++] = [hosts[the_host_id], item_data['name'], item_data['lastvalue']];
                }
                
            });
        });

        // fill in the list for host status
        _.each(agent_pings, function(statusid, hostid){
            if (statusid === '1') {
                status = 'up';
                text_class = 'text-success';
            } else {
                status = 'down'
                text_class = 'text-danger';
            }
            $('#ul_host_status').append('<li>' + hosts[hostid] + ': <strong class="' + text_class + '">' + status + '</strong></li>');
        });

        // fill in the list for system information
        _.each(system_unames, function(uname, hostid){
            $('#ul_system_uname').append('<li>' + hosts[hostid] + ': <br /><strong>' + uname + '</strong></li>');
        });

        // show temperatures
        _.each(temperatures, function(temperature_record, _){
            the_host_name = temperature_record[0];
            the_description = temperature_record[1];
            the_temperature = temperature_record[2];
            $('#tbody_temperature').append(
                "<tr>" +
                "<td>" + the_host_name + "</td>" +
                "<td>" + the_description + "</td>" +
                "<td>" + parseFloat(the_temperature).toFixed(2) + "</td>" +
                "</tr>");
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

        // make graph for CPU iowait time
        var chart_data_cpu_iowait_time = makeLineChartData(cpu_iowait_times, hosts);
        makeLineChart("chart_cpu_iowait_time", chart_data_cpu_iowait_time);

        // make graph for CPU user time
        var chart_data_cpu_user_time = makeLineChartData(cpu_user_times, hosts);
        makeLineChart("chart_cpu_user_time", chart_data_cpu_user_time);

        // make graph for numbers of logged in users
        var chart_data_loggedin_user_nums = makeLineChartData(loggedin_user_nums, hosts);
        makeLineChart("chart_loggedin_user_num", chart_data_loggedin_user_nums);

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

