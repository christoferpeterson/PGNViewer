Array.prototype.clean = function(deleteValue) {
	for (var i = 0; i < this.length; i++) {
		if (this[i] == deleteValue) {
			this.splice(i, 1);
			i--;
		}
	}
	return this;
};

Array.prototype.searchByProperty = function (prop, value) {
	if(prop && value) {
		for (var i = 0; i < this.length; i++) {
			if (this[i][prop] === value) {
				return i;
			}
		}
	}
	
	return -1;
}

String.prototype.nestedExclude = function(start, end) {
	var s = this;
	if(start == end)
	{
		return false;
	}

	var output = "";
	var count = 0;
	var prev = "";
	var groups = [];

	for (var i = 0; i < s.length; i++) {
		if(s[i] == start) {
			count++;
			groups[groups.length] = [];
			groups[groups.length-1][count-1] = "";
		}
		else if(s[i] == end) {
			count--;
		}
		else
		{
			if(count == 0) {
				if(!((prev == start || prev == end) && s[i] == " ")) {
					output += s[i];
				}
			}
			else {
				if(!((prev == start || s[i+1] == end) && s[i] == " ")) {
					if(groups !== undefined) {
						groups[groups.length-1][count-1] += s[i];
					}
				}
			}
		}

		prev = s[i];
	};

	return { output: output, groups: groups};
}

// Convert a string into a nested array of objects based on start and end points
String.prototype.buildNestedObject = function(start, end) {
	if(start == end) {
		return undefined;
	}

	var s = this;
	var output = [];
	var openCount = 0;
	var currentString = "";
	var baseString = "";
	var i = s.indexOf(start);
	var j = 0;
	
	if(i == -1) {
		return undefined;
	}
	else {
		openCount = 1;
	}

	while(i < s.length)
	{
		if(s.substr(i,start.length) == start)
		{
			openCount = 1;
			j = i+1;
			currentString = "";
			baseString = "";

			while(openCount != 0 && j < s.length)
			{
				if(s.substr(j,start.length) === start) {
					openCount++;
				}

				if(s.substr(j,end.length) === end) {
					openCount--;
				}

				if(openCount != 0) {
					currentString += s[j];
				}

				if(openCount === 1 && s.substr(j,end.length) !== end) {
					baseString += s[j];
				}

				j++;
			}

			i += currentString.length || 1;

			// use recursion to get nested values
			var nested = currentString.buildNestedObject(start, end);
			output.push({ text: baseString, fullText: currentString, sub: nested });
		}
		else
		{
			i++;
		}
	}
	
	return output;
}