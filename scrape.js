var 
  Crawler = require("node-webcrawler"),
  url = require('url'),
  mkpath = require('mkpath'),
  fs = require('fs'),
  cheerio = require('cheerio'),
  request = require('request'),
  async = require("async");
  // request.debug = true;


var messages = {
  success: {
    createdDirs: '\nDirectories created:\n dist/sitemap \n dist/newbuildings \n'
  }
};

// Array with strings - urls to be parsed (without baseUrl)
var obj;
// Array with strings - errored (404) urls, with redirects
// var erroredPages = [];
var siteURL = 'http://www.novostroy-m.ru';

function mkDir(cb){
  mkpath.sync('dist/sitemap', 0700);
  mkpath.sync('dist/newbuildings', 0700);
  console.log(messages.success.createdDirs);
  console.log('mkDir(); done!');
  cb();
}

function generateSitemap(cb){
  var URLs = [];
  var counter = 0;

  var c = new Crawler({
    maxConnections : 10,
    skipDuplicates: true,

    // This will be called for each crawled page
    callback : function (error, result, $) {
      if(error){
        console.log(error);
      } else {
        $('.h3 a').each(function(index, a) {
          var neededLink = $(a).attr('href');
          if(neededLink.includes("/baza/")){
            console.log(++counter + ' Scraping URL for sitemap : ' + neededLink);
            URLs.push(neededLink.replace("/baza/", ''));
            // URLs.push({url: neededLink.replace("/baza/", '')});
          }
        });
      }
    },
    // Define what to do when queue is empty
    onDrain: function(pool){
      fs.writeFile('dist/sitemap/sitemap.json', JSON.stringify(URLs, null, 2), function(err){
        if(err) {return console.log(err);} else{console.log('Successfully wrote to dist/sitemap/sitemap.json');}
        console.log("Now it's the fucking last message");
      });
      // Stop queueing
      pool.destroyAllNow();
      cb();
    }
  });

  // Queue using a function
  var novostroyPage = function(pageCounter) {
    return 'http://www.novostroy-m.ru/baza/?page=' + pageCounter;
  };

  // i - number of pages
  for(var i = 1; i <= 67; i++){
    c.queue({
      uri: novostroyPage('' + i + '')
    });
  }
}

function mkNewbuildingDirs(cb){
  fs.readFile('dist/sitemap/sitemap.json', 'utf8', function (err, data) {
    if (err) {
      throw err;
    } else {
      obj = JSON.parse(data);

      console.log('Total number of newbuildings: ' + obj.length);

      for(var i = 0; i < obj.length; i++){
        console.log((i+1) + ' Creating dir for URL: ' + obj[i]);
        mkpath.sync('dist/newbuildings/' + obj[i], 0700);
        mkpath.sync('dist/newbuildings/' + obj[i] + '/images', 0700);
        mkpath.sync('dist/newbuildings/' + obj[i] + '/planimages', 0700);
        mkpath.sync('dist/newbuildings/' + obj[i] + '/docs', 0700);
      }
      cb();
    }
  });
}

// var errors = 0;
// var counter = 0;
// in miliseconds
// var totalParsingTime = 0;

function crawlNewbuildings(cb){
  var
    counter = 0,
    totalParsingTime = 0,
    errors = 0;

  var c = new Crawler({
    maxConnections : 20,
    skipDuplicates: true,
    onDrain: function(pool){
      console.log('Successfully crawled newbuildings!' + '\n Total parsing time : ' + totalParsingTime + ' ms');
      pool.destroyAllNow();
      cb();
    }
  });

  // Queue using a function
  var novostroyPage = function(newbuilding) {
    return 'http://www.novostroy-m.ru/baza/' + newbuilding;
  };

  // i - number of pages
  for(var i = 0; i < obj.length; i++){
    c.queue([{
      uri: novostroyPage(obj[i]),
      time: true,
      callback : function (error, result, $, response) {
        if(error){
          errors += 1;
          console.log(error);
          console.log('total errors for now : ' + errors);
        } else {
          counter += 1;
          var newbuildingName = $('link[rel="canonical"]').attr('href').replace("http://www.novostroy-m.ru/baza/", '');
          fs.writeFileSync('dist/newbuildings/' + newbuildingName + '/index.html', result.body, 'utf8');
          console.log('\n' + counter + ' index.html saved for ' + newbuildingName + '\nresponse elapsed time: ' + result.elapsedTime);
          totalParsingTime += result.elapsedTime;
        }
      }
    }]);
  }
}

function crawlTestimonials(cb){
  var
    counter = 0,
    totalParsingTime = 0,
    errors = 0;

  var c = new Crawler({
    maxConnections : 20,
    skipDuplicates: true,
    onDrain: function(pool){
      console.log('Successfully crawled testimonials!' + '\n Total parsing time : ' + totalParsingTime + ' ms');
      pool.destroyAllNow();
      cb();
    }
  });

  // Queue using a function
  var testimonialsPage = function(newbuilding) {
    return 'http://www.novostroy-m.ru/baza/' + newbuilding + '/otzyvy';
  };

  // i - number of pages
  for(var i = 0; i < obj.length; i++){
    c.queue([{
      uri: testimonialsPage(obj[i]),
      time: true,
      callback : function (error, result, $, response) {
        if(error){
          errors += 1;
          console.log(error);
          console.log('total errors for now : ' + errors);
        } else {
          counter += 1;
          var newbuildingName = $('link[rel="canonical"]').attr('href')
            .replace("http://www.novostroy-m.ru/baza/", '')
            .replace("/otzyvy", '');
          fs.writeFileSync('dist/newbuildings/' + newbuildingName + '/testimonials.html', result.body, 'utf8');
          console.log('\n' + counter + ' testimonials.html saved for ' + newbuildingName + '\nresponse elapsed time: ' + result.elapsedTime); 
          totalParsingTime += result.elapsedTime;
        }
      }
    }]);
  }
}

function writeDescJson(cb){
  var
    erroredPages = [],
    erroredPagesNum = 0,
    jsonCounter = 0;
  
  obj.forEach(function(index){
    fs.access('dist/newbuildings/' + index + '/index.html', fs.constants.F_OK, function(err){
      if(err){
        erroredPagesNum += 1;
        erroredPages.push(index);
      } else {
        fs.readFile('dist/newbuildings/' + index + '/index.html', 'utf8', function(err, data){
          if(err){
            throw err;
          } else {
            jsonCounter += 1;
            var $ = cheerio.load(data);
            var LatLng = data.substring((data.indexOf('coord')+10), (data.indexOf('coord')+51));

            // Create and populate newbuilding object with description 
            var newbuilding = {};

            newbuilding.url = siteURL + '/baza/' + index;
            newbuilding.name = $('.c-title-item').text();
            newbuilding.address = $('.address').text();
            newbuilding.prices          = {
              date: $('.under-price').text(),
              range: $('.ot_price').text(),
              // Not reachable with request (use casper.js instead)
              propTypeOne: {},
              propTypeTwo: {},
              propTypeThree: {},
              propTypeFour: {},
              propTypeFive: {}
            };

            // populate metro stations
            newbuilding.metro = [];
            var neededMetros = $('.d-metro').find('.metro_icon').next();
            neededMetros.each(function(index){
              newbuilding.metro.push($(this).text());
            });

            // populate train stations
            newbuilding.train = [];
            var neededTrains = $('.d-metro').find('.zhd_station_i').next();
            neededTrains.each(function(index){
              newbuilding.train.push($(this).text());
            });

            // populate road highways
            newbuilding.road = [];
            var neededRoads = $('.d-metro').find('.road_i').next();
            neededRoads.each(function(index){
              newbuilding.road.push($(this).text());
            });
            
            newbuilding.developer = $('.brief table').find($("td:contains('Застройщик')")).next().text();
            newbuilding.developerURL = siteURL + $('.brief table').find($("td:contains('Застройщик')")).next().find('a').attr('href');
            newbuilding.delivery = $('.brief table').find($("td:contains('Срок ГК')")).next().text();
            newbuilding.areaRange = $('.brief table').find($("td:contains('Площадь квартир')")).next().text();
            newbuilding.projType = $('.brief table').find($("td:contains('Тип проекта')")).next().text();
            newbuilding.ceilingHeight = $('.brief table').find($("td:contains('Высота потолков')")).next().text();
            
            newbuilding.mortgage = {
              usual: $('.brief table').find($("td:contains('Ипотека')")).next().text(),
              military: $('.brief table').find($("td:contains('Военная ипотека')")).next().text(),
              lenders: []
            };

            var neededLenders = $('#novos-desc-banks').find('.marker');
            neededLenders.each(function(index){
              newbuilding.mortgage.lenders.push($(this).text());
            });

            newbuilding.maternalCapital = $('.brief table').find($("td:contains('Материнский капитал')")).next().text();
            newbuilding.facing = $('.brief table').find($("td:contains('Отделка')")).next().text();
            newbuilding.detailedInfo = $('.text_build').text();
            newbuilding.planDesc = $(".item_title:contains('Планировки')").next().text();
            newbuilding.infraDesc = $(".item_title:contains('Инфраструктура')").next().text();
            newbuilding.purchaseMethods = $(".item_title:contains('Способы покупки')").next().text();
            
            newbuilding.agreementType = [];
            var neededAgreementTypes = $(".item_title:contains('Тип договора')").next().find('li');
            neededAgreementTypes.each(function(index){
              newbuilding.agreementType.push($(this).text());
            });
            
            newbuilding.whereabout = [];
            var neededWhereabouts = $(".item_title:contains('Как проехать')").nextAll('p');
            neededWhereabouts.each(function(index){
              newbuilding.whereabout.push($(this).text());
            });
            
            newbuilding.video = $('a[data-tab-name="youtube"]').attr('data-video');
            newbuilding.pano = $('a[data-tab-name="panorams"]').attr('data-video');
            newbuilding.aerotour = $('a[data-tab-name="aerotour"]').attr('data-video');
            newbuilding.webcam = $('a[data-tab-name="camera"]').attr('data-video');
            newbuilding.seller = {
              title: $('#sellers').find('.build_item_title').text(),
              url: siteURL + $('#sellers').find('.build_item_title').attr('href'),
              img: siteURL + $('.build_item_img img').attr('src'),
              tel: $('.display-tell').attr('data-advert-value')
            };
            newbuilding.gmapCoords = {
              Lat: LatLng.substring(0, LatLng.indexOf('\"')),
              Lng: LatLng.substring((LatLng.indexOf(',')+3), (LatLng.indexOf(']')-1)).replace(/ /g,'')
            };
            newbuilding.imgs = [];
            newbuilding.planImgs = [];
            newbuilding.docs = [];

            // populate imgs
            var neededImgs = $("img[src*='/novos/860x450/']");

            neededImgs.each(function(index){
              var 
                imgSrc = $(this).attr('src'),
                imgPath = siteURL + imgSrc,
                imgFilename = imgSrc.replace("/images/novos/860x450/", "");

              newbuilding.imgs
                .push({
                  url: imgPath,
                  caption: $(this).attr('data-caption')
                });
            });

            // populate planImgs
            var neededPlanImgs = $("img[src*='/plans/860x450/']");

            neededPlanImgs.each(function(index) {
              var 
                planImgSrc = $(this).attr('src'),
                planImgpath = siteURL + planImgSrc,
                imgFilename = planImgSrc.replace("/images/plans/860x450/", "");

              newbuilding.planImgs
                .push({
                  url: planImgpath
                });
            });

            // populate docs
            var neededDocs = $('.doc_item');

            neededDocs.each(function(index){
              var 
                docHref = $(this).attr('href'),
                docPath = siteURL + docHref,
                docFilename = docHref.replace("/files/novos/docs/", "");

              newbuilding.docs
                .push({
                  url: siteURL + docHref,
                  name: $(this).find('.doc_info_item').text()
                });
            });

            fs.writeFileSync('dist/newbuildings/' + index + '/description.json', JSON.stringify(newbuilding, null, 2));
            console.log(jsonCounter + ' saved dist/newbuildings/' + index + '/description.json');
          }
        });
      }
    });
  });
  cb();
}

function writeTestimonialsJson(cb){
  var
    erroredPages = [],
    erroredPagesNum = 0,
    jsonCounter = 0;

  obj.forEach(function(index){
    fs.access('dist/newbuildings/' + index + '/testimonials.html', fs.constants.F_OK, function(err){
      if (err) {
        erroredPagesNum += 1;
        erroredPages.push(index);
      } else {
        fs.readFile('dist/newbuildings/' + index + '/testimonials.html', 'utf8', function(err, data){
          if (err) {
            throw err;
          } else {
            jsonCounter += 1;
            var 
              $ = cheerio.load(data),
              testimonials = [],
              neededTestimonials = $('.comment_body .info');

            neededTestimonials.each(function(){
              testimonials.push({
                author: $(this).find('.user').find('.c_writer').text(),
                authorURL: $(this).find('.user').find('.c_writer a').attr('href'),
                date: $(this).find('.user').find('.data').text(),
                message: $(this).find('.message').text(),
                rating: $(this).find('.rate_num').text(),
                citedAuthor: $(this).find('.message_body').find('.name_box').find('.c_writer').text(),
                citedText: $(this).find('cite').text(),
                citedDate: $(this).find('.message_body .data').text(),

              });
            });

            fs.writeFileSync('dist/newbuildings/' + index + '/testimonials.json', JSON.stringify(testimonials, null, 2));
            console.log(jsonCounter + ' saved dist/newbuildings/' + index + '/testimonials.json');
          }
        });
      }
    });
  });
  cb();
}

// Make directories for sitemap and parsed newbuildings
mkDir(function(){
  // walk through www.novostroy-m.ru/baza/?page=n & generate sitemap of parsed newbuildings
  generateSitemap(function(){
    // create a separate directory for each newbuilding from sitemap
    mkNewbuildingDirs(function(){
      crawlNewbuildings(function(){
        crawlTestimonials(function(){
          writeDescJson(function(){
            writeTestimonialsJson(function(){

            });
          });
        });
      });
    });
  });
});
