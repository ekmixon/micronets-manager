// Initializes the `micronets` service on path `/mm/v1/micronets`
const createService = require ( 'feathers-mongoose' );
const createModel = require ( '../../models/micronets.model' );
const hooks = require ( './micronets.hooks' );
const logger = require ( './../../logger' );

module.exports = function ( app ) {
  const Model = createModel ( app );
  const paginate = app.get ( 'paginate' );

  const options = {
    id: 'id',
    Model ,
    paginate
  };

  // Initialize our service with any options it requires
  app.use ( '/mm/v1/subscriber' , createService ( options ) );

  // Get our initialized service so that we can register hooks
  const service = app.service ( 'mm/v1/subscriber' );
  service.hooks ( hooks );

  app.use ( '/mm/v1/micronets/init' , async ( req , res , next ) => {
    const { path , originalUrl , method } = req
    const result = await service.create (
      { req : req } ,
      { params : service.hooks.params }
    )
    service.on ( 'created' , ( micronet ) => {} )
    res.json ( result )
  } );

  app.use ( `/mm/v1/subscriber/:id/micronets/:micronetId/devices` , async ( req , res , next ) => {
    const { path , originalUrl , method , params } = req
    if ( method == 'POST' ) {
      const result = await service.create (
        { req : req } ,
        { params : service.hooks.params }
      )
      service.on ( 'created' , ( micronet ) => { } )
      res.json ( result )
    }

  } );

  app.use ( `/mm/v1/subscriber/:id/micronets/:micronetId` , async ( req , res , next ) => {
    const { path , originalUrl , method , params, body } = req
    if ( method == 'DELETE' ) {
      const result = await service.remove ({...params})
      service.on ( 'deleted' , ( micronet ) => { } )
      res.json ( result )
    }
  } );

  app.use ( `/mm/v1/subscriber/:id/micronets` , async ( req , res , next ) => {
    const { path , originalUrl , method , params, body } = req

    if ( method == 'POST' ) {
      const result = await service.create (
        { req : req } ,
        { params : service.hooks.params }
      )
      service.on ( 'created' , ( micronet ) => { } )
      res.json ( result )

    }

    if ( method == 'DELETE' ) {
      const result = await service.remove ({...params})
      service.on ( 'deleted' , ( micronet ) => { } )
      res.json ( result )
    }

  } );


  app.service ( '/mm/v1/micronets/users' ).on ( 'userDeviceRegistered' , ( data ) => {
    service.create ( { ...data } , { params : service.hooks.params } )
  } )
};
