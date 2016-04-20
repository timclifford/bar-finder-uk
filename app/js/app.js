function viewModel() {
  var self = this;
  var map, city, infowindow;
  var grouponLocations = [];

  // Groupon Readable Name and ID
  var grouponReadableNames = [];
  var grouponReadableID = [];

  // Iinitial list of foursquare results.
  this.foursquareItems = ko.observableArray([]);
  // List filtered by search keyword
  this.filteredList = ko.observableArray([]);
  // Holds all map markers.
  this.mapMarkers = ko.observableArray([]);
  // Default user feedback status.
  this.fourStatus = ko.observable('Searching bars...');
  // Search status observable.
  this.searchStatus = ko.observable();

  // Default location and loading gif.
  this.searchLocation = ko.observable('Bristol & Bath');
  this.loadImg = ko.observable();

  // Default filter.
  this.filterType = ko.observable('Bar');

  // Store total number of results in filtered list.
  this.numResults = ko.computed(function() {
    return self.filteredList().length;
  });

  // Store toogle for info window.
  this.toggleSymbol = ko.observable('hide');

  // Hold the current location's lat & lng - useful for re-centering map
  this.currentLat = ko.observable(51.454513);
  this.currentLng = ko.observable(-2.5879099999999653);

  // When results are returned and user clicks on the item, open its info window.
  this.goToMarker = function(clickedResult) {
    var clickedResultName = clickedResult.fourName;
    for(var key in self.mapMarkers()) {
      if(clickedResultName === self.mapMarkers()[key].marker.title) {
        map.panTo(self.mapMarkers()[key].marker.position);
        map.setZoom(14);
        infowindow.setContent(self.mapMarkers()[key].content);
        infowindow.open(map, self.mapMarkers()[key].marker);
        map.panBy(0, -150);
        self.mobileShow(false);
        self.searchStatus('');
      }
    }
  };

  // Handle the user input for results in a location.
  this.processLocationSearch = function() {
    self.searchStatus('');
    self.searchStatus('Searching...');
    var newAddress = $('#autocomplete').val();
    
    // newLocationID, new Lat and newLng will hold new data for the inputted city.
    var newLocationID, newLat, newLng;
    // Store search query of bars.
    var newType = "Bar";

    // Use Groupon Locations to find city locations, lat and lng as Foursquare doesn't have this in their API.
    // This does effect the precision of the end search results from Foursquare
    // @ToDo - Find a better way to return Foursquare locations.
    var divisionsLen = grouponLocations.divisions.length;
    for(var i = 0; i < divisionsLen; i++) {
      var name = grouponLocations.divisions[i].name;

      if(newAddress == name) {
          newLocationID = grouponLocations.divisions[i].id;
          newLat = grouponLocations.divisions[i].lat;
          newLng = grouponLocations.divisions[i].lng;       
          self.currentLat(grouponLocations.divisions[i].lat);
          self.currentLng(grouponLocations.divisions[i].lng);
          self.searchStatus('Location found');
      }
    }

    // Validation check - if user enters an invalid location, return error.
    if(!newLocationID) {
      return self.searchStatus('Unknown location, please try again.');
    } else {
      // Replace current location with new location through data-bind on #autocomplete.
      self.searchLocation(newAddress);
      // Clear our current item and markers.
      clearMarkers();
      self.foursquareItems([]);
      self.filteredList([]);
      // Show loading message as a status and loading gif as visual.
      self.fourStatus('Loading...');
      self.loadImg('<img src="img/ajax-loader.gif">');
      // Perform new foursquare search and center map to new location.
      getFoursquares(newLocationID, newLat, newLng, newType);
      map.panTo({lat: self.currentLat(), lng: self.currentLng()});
    }
  };

  // Set filterKeyword data-bind to a ko array.
  this.filterKeyword = ko.observable('');

  // Compare search keyword against foursquare 'name' of current results.
  // Return a filtered list and map markers of request.
  this.filterResults = function() {
    // Change search work to lowercase.
    var searchWord = self.filterKeyword().toLowerCase();
    // Grab fourSquare items data and store in an array.
    var array = self.foursquareItems();
    if(!searchWord) { // If empty return instantly.
      return;
    } else {
      // First clear out all input in the filteredList array
      self.filteredList([]);
      // Loop through the foursquareItems array and see if the search keyword matches
      // with any venue name from the results in the list. If so, push that object to the filteredList 
      // array and place the marker on the map.
      for(var i=0; i < array.length; i++) {
        var searchName = array[i].fourName;
        if(searchName.toLowerCase().indexOf(searchWord) != -1) {
            self.mapMarkers()[i].marker.setMap(map);
            self.filteredList.push(array[i]);
        } else {
          // Catch all others.
          for(var j = 0; j < array[i].fourName.length; j++) {
              if(array[i].fourName[j].toLowerCase().indexOf(searchWord) != -1) {
                self.mapMarkers()[i].marker.setMap(map);
                self.filteredList.push(array[i]);
              // Otherwise hide all other markers from the map.
              } else {
                self.mapMarkers()[i].marker.setMap(null);
              }
          } // End loop.

          // Return status message with number of results for filtered search.
          self.fourStatus(self.numResults() + ' results found for ' + self.filterKeyword());
        }
      } // End loop.
    }
  };

  // Clear keyword from filter and show all results  in current location.
  this.clearFilter = function() {
    self.filteredList(self.foursquareItems());
    self.fourStatus(self.numResults() + ' results ' + self.searchLocation());
    self.filterKeyword('');
    for(var i = 0; i < self.mapMarkers().length; i++) {
      self.mapMarkers()[i].marker.setMap(map);
    }
  };

  // Toggles the list view.
  this.listToggle = function() {
    if(self.toggleSymbol() === 'hide') {
      self.toggleSymbol('show');
    } else {
      self.toggleSymbol('hide');
    }
  };

  // Error handling if Google Maps fails to load.
  this.mapRequestTimeout = setTimeout(function() {
    $('#map-canvas').html('Google Maps has had difficulty loading. Try refresh the page.');
  }, 8000);

// Initialise Google map, perform initial search on a city.
  function mapInitialise() {
    // Initalise map at Bristol.
    city = new google.maps.LatLng(51.454513, -2.5879099999999653);
    map = new google.maps.Map(document.getElementById('map-canvas'), {
          center: city,
          zoom: 14,
          zoomControlOptions: {
            position: google.maps.ControlPosition.LEFT_CENTER,
            style: google.maps.ZoomControlStyle.SMALL
          },
          streetViewControlOptions: {
            position: google.maps.ControlPosition.LEFT_BOTTOM
            },
          mapTypeControl: false,
          panControl: false
        });
    clearTimeout(self.mapRequestTimeout);

    google.maps.event.addDomListener(window, "resize", function() {
       var center = map.getCenter();
       google.maps.event.trigger(map, "resize");
       map.setCenter(center); 
    });

    // Calls location for Bristol as default.
    infowindow = new google.maps.InfoWindow({maxWidth: 300});
    // Set deafult search.
    getFoursquares('Bristol', '51.4', '-2.59', 'Bar');
    // Get UK locations.
    getGrouponLocations();
  }

// Use API to get foursquare data and store the info as objects in an array.
  function getFoursquares(vlocation, lat, long, type) {
    var foursquareUrl = "https://api.foursquare.com/v2/venues/search?client_id=IMHE5GPYK3BFTF32Z4Q2ZNQKF5YCSM4HSBOWV1POF1HU0OXV&client_secret=XUNHH5D50QSYSYNMODIZIZGTTQTW3OP4VCXJX2PEVIGKMKDV&v=20130815";
    var divId = '&near=' + vlocation;
    var ll = '&ll=' + lat + ',' + long;
    var uk = '-united-kingdom';
    var queryType = '&query=' + type;

    $.ajax({
      url: foursquareUrl + queryType + ll + divId + uk,
      dataType: 'jsonp',
      success: function(data) {
        var resultsLen = data.response.venues.length;
        for(var i = 0; i < resultsLen; i++) {
          var venueLocation = data.response.venues[i].location;
          var gIcon = data.response.venues[i].categories[0];
            // This filters out results that don't have a location.
            if (data.response.venues[i].name === undefined) continue;
            var venueName = data.response.venues[i].name;
                venueLat = venueLocation.lat,
                venueLon = venueLocation.lng,
                gLink = "https://foursquare.com/v/" + data.response.venues[i].id,
                city = venueLocation.city;

            var gImgPre, gImgSuf, gImg;
             if((gIcon == null) || gIcon === undefined ) { 
                gIcon = "";
             } else {
                gIcon = data.response.venues[i].categories[0].icon;
                gImgPre = gIcon.prefix,
                gImgSuf = gIcon.suffix;
                gImg = gImgPre + 'bg_88' + gImgSuf;
             }

            if((venueLocation.postalCode == null) || venueLocation.postalCode === undefined ) { 
              postalCode = '';
            } else {
              postalCode = venueLocation.postalCode;
            }

            if((venueLocation.address == null) || venueLocation.address === undefined ) { 
              venueLocation.address = 'UK';
            } else {
              address = venueLocation.address;
            }

          var checkinsCount;
          if((data.response.venues[i].stats.checkinsCount == null) || data.response.venues[i].stats.checkinsCount === undefined ) { checkinsCount = '';
          } else {
            var num = data.response.venues[i].stats.checkinsCount;
            var decimal = num.toFixed(1);
            checkinsCount = '<span class="rating">Check-ins: </span> ' + decimal;
          }

          self.foursquareItems.push({
            fourName: venueName, 
            fourLat: venueLat, 
            fourLon: venueLon,
            fourLink: gLink,
            fourIcon: gIcon,
            fourImg: gImg, 
            fourAddress: address + "<br>" + city + ", " + postalCode,
            fourRating: checkinsCount
          });

        }
        self.filteredList(self.foursquareItems());
        mapMarkers(self.foursquareItems());
        self.searchStatus('');
        self.loadImg('');
      },
      error: function() {
        self.fourStatus('Oops, something went wrong, please refresh and try again.');
        self.loadImg('');
      }
    });
  }

// Create and place markers and info windows on the map.
  function mapMarkers(array) {
    $.each(array, function(index, value) {
      var latitude = value.fourLat,
          longitude = value.fourLon,
          geoLoc = new google.maps.LatLng(latitude, longitude),
          thisRestaurant = value.fourName;

      var contentString = '<div id="infowindow">' +
      '<img src="' + value.fourImg + '">' +
      '<h2>' + value.fourName + '</h2>' +
      '<p>' + value.fourAddress + '</p>' +
      '<p class="checkinsCount">' + value.fourRating + '</p>' +
      '<p><a href="' + value.fourLink + '" target="_blank">Click to see result</a></p></div>';

      var marker = new google.maps.Marker({
        position: geoLoc,
        title: thisRestaurant,
        map: map
      });

      self.mapMarkers.push({marker: marker, content: contentString});

      self.fourStatus(self.numResults() + ' results ' + self.searchLocation());

      // Generate info windows for each result.
      google.maps.event.addListener(marker, 'click', function() {
        self.searchStatus('');
         infowindow.setContent(contentString);
         map.setZoom(14);
         map.setCenter(marker.position);
         infowindow.open(map, marker);
         map.panBy(0, -150);
       });
    });
  }

// Clear markers from map and array
  function clearMarkers() {
    $.each(self.mapMarkers(), function(key, value) {
      value.marker.setMap(null);
    });
    self.mapMarkers([]);
  }

// This ajax call uses the divisions data from Groupon API to use for validation in the Google Autocomplete search bar. 
// As Foursquare doesn't have a nice list of locations for their venues.

  function getGrouponLocations() {
    $.ajax({
      url: 'https://partner-int-api.groupon.com/division.json?country_code=UK',
      dataType: 'jsonp',
      success: function(data) {
        grouponLocations = data;
        var grouponLocationsLength = data.divisions.length;
        for(var i = 0; i < grouponLocationsLength; i++) {
          var readableName = data.divisions[i].name;
          var readableID = data.divisions[i].id;
          grouponReadableNames.push(readableName);
          grouponReadableID.push(readableID);
        }

        $('#autocomplete').autocomplete({
          lookup: grouponReadableNames,
          showNoSuggestionNotice: true,
          noSuggestionNotice: 'Sorry, no matching results'
        });
      },
      error: function() {
        self.fourStatus('Error, please reload the page and try again.');
        self.loadImg('');
      }
    });
  }

  // Manages the toggling of the list view, location centering, and search bar on a mobile device.
  this.mobileShow = ko.observable(false);
  this.searchBarShow = ko.observable(true);

  this.mobileToggleList = function() {
    if(self.mobileShow() === false) {
      self.mobileShow(true);
    } else {
      self.mobileShow(false);
    }
  };

  this.searchToggle = function() {
    if(self.searchBarShow() === true) {
      self.searchBarShow(false);
    } else {
      self.searchBarShow(true);
    }
  };

  // Re-center map to current city if you're viewing bars that are further away.
  this.centerMap = function() {
      infowindow.close();
      var currCenter = map.getCenter();
      var cityCenter = new google.maps.LatLng(self.currentLat(), self.currentLng());
      self.searchStatus('Map centered');
      map.panTo(cityCenter);
      map.setZoom(14);
  };

  mapInitialise();
}

// Custom binding highlights the search text on focus
ko.bindingHandlers.selectOnFocus = {
  update: function (element) {
    ko.utils.registerEventHandler(element, 'focus', function (e) {
      element.select();
    });
  }
};

ko.applyBindings(new viewModel());