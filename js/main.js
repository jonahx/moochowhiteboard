/*

This week with each persons name and the items below. Then second view is running tally. Each person name on the
left going down with columns going across. On top week of 1/18, then week of
1/25 etc. then next to their name for that date is have win or loss (pass or
fail or whatever you name it) and then you could have a box below that each
week for each person that says a reason (I would decide up front on what the 3
to 5 reasons could be like: focus, new work superseded, personal issue,
underestimated, scope changed or whatever. It might be good to have a third box
for each person with what was supposed to be done so you could look back at how
far behind we are on stuff for people to really understand the gravity. That
doesn't need to be on the dash either, but one click away, maybe you click on
the pass/fail and can see what was supposed to be done and the reason and the
dash just shows dates with pass fail.

task name
employee

*/

var client = Asana.Client.create().useAccessToken('<ASANA ACCESS TOKEN HERE>');

app = {};
app.ColumnComp = {
  controller: function() {

    var ret = {},
        safeUpdateFromAsana = safeFn(updateFromAsana);

    safeUpdateFromAsana();
    startAutoRefresh();
    return ret;

    function updateFromAsana() {
      m.startComputation();
      client.tasks.findAll({
        project: '<ASANA PROJECT ID>',
        limit: 100,
        modified_since: addDays(new Date(), -10), //ignore old tasks
        opt_fields: 'id,name,completed,assignee.name,due_on'
      }).then(tasks0 => {
        tasks0.fetch(200).then(tasks => {
          var tasksByEmployee = tasks.reduce((m,t) => addTask(m,t), {});
          removeDeletedEmployees(tasksByEmployee);
          updateTasksByEmployee(tasksByEmployee);
          m.endComputation();
        },() => { m.endComputation() }) 
      }, () => { m.endComputation() }); // call endComputation on error, otherwise screen will freeze
    }

    function addTask(tasksByEmployee, taskToAdd) {
      var t = taskToAdd,
          employee = employeeName(t),
          unassigned = !employee,
          notThisWeek = !dueThisWeek(t.due_on);
      if (unassigned || notThisWeek) return tasksByEmployee;
      tasksByEmployee[employee] = tasksByEmployee[employee] || [];
      t.justCompleted = justCompleted(employee, t);
      tasksByEmployee[employee].push(t);
      return tasksByEmployee;
    }

    // If all an employee's tasks have been deleted
    function removeDeletedEmployees(updatedTasks) {
      var updatedEmployees = Object.keys(updatedTasks),
          existingEmployees = Object.keys(ret);
      if (!(updatedEmployees && existingEmployees)) return;
      existingEmployees.forEach(e => {
        if (updatedEmployees.indexOf(e) < 0) delete ret[e];
      });
    }
    function updateTasksByEmployee(updatedTasks) {
      var employees = Object.keys(updatedTasks);
      employees.forEach(e => ret[e] = updatedTasks[e] );
    }
    function employeeName(task) {
      return task.assignee ? task.assignee.name.split(' ')[0] : null;
    }
    function startAutoRefresh() {
      var everyTenSeconds = 10*1000;
      setInterval(safeUpdateFromAsana, everyTenSeconds)
    }
    function justCompleted(employee, updatedTask) {
      var curTasks = ret[employee], curTask;
      if (!curTasks) return false; 
      curTask = curTasks.find((t) => t.id == updatedTask.id);
      return curTask && !curTask.completed && updatedTask.completed;
    }
  },
  view: function(ctrl) {
    return m('div', {config: autoFitColumns}, [
      weekIsDoneAudio(),
      taskIsDoneAudio(),
      playRelevantAudio(),
      m('div', {class: 'countdown'}, countDownText()),
      m('div', {class: 'column-ctnr'}, employees().map(e => {
        return m('div', {class: 'column'}, [
          m('h1', {class: employeeClass(e)}, e),
          m('ul', tasks(e))
        ])
      }))
    ]);
             
    function autoFitColumns() {
      var defaultFontSize = computedVal('font-size', document.body)
          cnt = 0;
      columns().forEach(c => c.style.fontSize = defaultFontSize);
      while (windowHasScrollbar() && cnt++ < 200) {
        decreaseFont(longestColumn());
      }

      function decreaseFont(col) {
        var fontSize = computedVal('font-size', col),
            decreasedSize = (parseInt(fontSize) - 1) + 'px';
        col.style.fontSize = decreasedSize;
      }
      function longestColumn() {
        var tallest = Math.max.apply(Math, columns().map(c => c.clientHeight));
        return columns().find(c => c.clientHeight == tallest);
      }
      function columns() {
        return [].slice.call(document.querySelectorAll('.column ul'));
      }
    }
    function windowHasScrollbar() {
      // scrollheiht does not incoude margin, but the margin DOES affect the scrollbar's appearing
      // return document.body.innerWidth > document.body.clientWidth
      var pageHeight =   parseInt(computedVal('height'))
                       + parseInt(computedVal('margin-top'))
                       + parseInt(computedVal('margin-bottom'));
      return document.body.scrollHeight > pageHeight;
    }
    function playRelevantAudio() {
      var audioId = getRelevantAudio();
      if (audioId == '') return '';
      return m('script', `document.getElementById('${audioId}').play()`);
    }
    function getRelevantAudio() {
      return someoneFinishedEverything() ? 'week-is-done-audio' :
             someoneCompletedATask()     ? 'task-is-done-audio' : '';
    }
    function weekIsDoneAudio() {
      return m('audio', {id: 'week-is-done-audio', preload: 'auto'}, [
        m('source', {src: 'mp3/rocky_theme.mp3', type: 'audio/mpeg'})
      ]);
    }
    function taskIsDoneAudio() {
      return m('audio', {id: 'task-is-done-audio', preload: 'auto'}, [
        m('source', {src: 'mp3/chalkmeup.mp3', type: 'audio/mpeg'})
      ]);
    }
    function someoneFinishedEverything() {
      return employees().some(e => {
        var justCompletedATask = ctrl[e].some(t => t.justCompleted);
        return allTasksComplete(e) && justCompletedATask;
      });
    }
    function someoneCompletedATask() {
      return employees().some(e => {
        return ctrl[e].some(t => t.justCompleted);
      });
    }
    function employeeClass(e) {
      return allTasksComplete(e) ? 'gold-star' : '';
    }
    function allTasksComplete(e) {
      return ctrl[e].every(t => t.completed);
    }
    function employees() {
      return Object.keys(ctrl);
    }
    function tasks(e) {
      return ctrl[e].map(t => m('li', {class: taskClass(t)}, t.name));
    }
    function taskClass(t) {
      return t.completed ? 'complete' : 'incomplete';
    }
    function countDownText(date) {
      var now = new Date(),
          launch = config().launchDate,
          launchDescription = config().launchDateDescription,
          diff = launch - now,
          dayMs = 1000*60*60*24,
          weekMs = dayMs*7,
          weeks = Math.floor(diff/weekMs),
          days = Math.floor((diff - weeks*weekMs)/dayMs) + 1,
          weeksText = weeks > 0 ? `${weeks} weeks, ` : '',
          daysText = `${days} days`;
      return (diff <= 0) ? `${launchDescription} is here!`
                         : `${weeksText}${daysText} until ${launchDescription}`;
    }
  }
}

m.mount(document.body, app.ColumnComp);


//////////////////////
// Util
//////////////////////
function dueThisWeek(yyyyMmDd) {
  if (!yyyyMmDd) return false;
  var nextMeeting = getNextMeeting(),
      prevMeeting = addDays(nextMeeting, -7), //TODO: factor out assumption of weekly meeting
      dateToCheck = parseYmd(yyyyMmDd);
  return dateToCheck > prevMeeting && dateToCheck <= nextMeeting;
}
function computedVal(val, elm) {
  elm = elm || document.body;
  return getComputedStyle(elm).getPropertyValue(val);
}
function parseYmd(str) {
  var ymd = str.split('-');
  return new Date(ymd[0], ymd[1] - 1, ymd[2]);
}
function config() {
  return {
    meetingDay: 1,
    meetingTime: [18,0,0,0], // 5pm
    launchDate: new Date(2016,6,1), // July 1
    launchDateDescription: 'July 1st'
  };
}
function getNextMeeting() {
  var now = new Date(),
      meetingDay = config().meetingDay,
      ret = jumpForwardToDayOfWeek(now, meetingDay);
  ret.setHours.apply(ret, config().meetingTime);
  var justFinishedMeeting = now.getDay() == meetingDay && now > ret;
  return justFinishedMeeting ? addDays(ret, 7) : ret;
}
function jumpForwardToDayOfWeek(date, dayOfWeek) {
  date = new Date(date);
  while (date.getDay() != dayOfWeek) { date = addDays(date, 1) }
  return date;
}
function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
function safeFn(fn) {
  return function() {
    var args = [].slice.call(arguments);
    try { return fn.apply(null, args) }
    catch(err) { console.log(err) }
  }
}
