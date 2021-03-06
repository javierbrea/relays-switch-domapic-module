const path = require('path')

const test = require('narval')

const DomapicMocks = require('./Domapic.mocks')
const GpioInMocks = require('./GpioIn.mocks')
const GpioOutMocks = require('./GpioOut.mocks')

test.describe('server', () => {
  let domapic
  let gpioIn
  let gpioOut
  let abilities

  test.before(async () => {
    domapic = new DomapicMocks()
    gpioIn = new GpioInMocks()
    gpioOut = new GpioOutMocks()
    require('../../server')
  })

  test.after(() => {
    gpioIn.restore()
    gpioOut.restore()
    domapic.restore()
  })

  test.describe('when required', () => {
    test.before(async () => {
      domapic.stubs.module.config.get.resolves(false)
      domapic.utils.executeModuleListener(domapic.stubs.module)
      await domapic.utils.resolveOnStartCalled()
    })

    test.it('should have created a Domapic Module, passing the package path', () => {
      test.expect(domapic.stubs.createModule.getCall(0).args[0].packagePath).to.equal(path.resolve(__dirname, '..', '..'))
    })

    test.it('should have called to start the gpio', () => {
      test.expect(gpioIn.stubs.instance.init).to.have.been.called()
    })

    test.it('should have called to start the server', () => {
      test.expect(domapic.stubs.module.start).to.have.been.called()
    })

    test.describe('when domapic module is returned', () => {
      test.it('should have created a domapic gpio in', () => {
        test.expect(gpioIn.stubs.Constructor).to.have.been.calledWith(domapic.stubs.module, {}, {
          debounceTimeout: 'debounce',
          gpio: 'sensorGpio'
        })
      })

      test.it('should have registered abilities', () => {
        abilities = domapic.stubs.module.register.getCall(0).args[0]
        test.expect(domapic.stubs.module.register).to.have.been.called()
      })
    })

    test.describe('switch state handler', () => {
      test.it('should return current gpio status', () => {
        gpioIn.stubs.instance.status = true
        test.expect(abilities.switch.state.handler()).to.equal(true)
      })
    })

    test.describe('switch action handler', () => {
      test.it('should toggle switch if current status is different to target status', async () => {
        gpioIn.stubs.instance.status = true
        await abilities.switch.action.handler(false)
        test.expect(gpioOut.stubs.instance.setStatus).to.have.been.called()
      })

      test.it('should not toggle switch if current status is equal to target status', async () => {
        gpioOut.stubs.instance.setStatus.reset()
        gpioIn.stubs.instance.status = true
        await abilities.switch.action.handler(true)
        test.expect(gpioOut.stubs.instance.setStatus).to.not.have.been.called()
      })
    })

    test.describe('sensor events listener', () => {
      test.it('should emit a domapic event', () => {
        gpioIn.utils.getEventListener()(true)
        test.expect(domapic.stubs.module.events.emit).to.have.been.calledWith('switch', true)
      })
    })

    test.describe('relays state handler', () => {
      test.it('should return current relays status', () => {
        gpioOut.stubs.instance.status = true
        test.expect(abilities.relaysSwitch.state.handler()).to.equal(true)
      })
    })

    test.describe('relays action handler', () => {
      test.it('should change relay 1 status', async () => {
        await abilities.relaysSwitch.action.handler(false)
        test.expect(gpioOut.stubs.instance.setStatus).to.have.been.calledWith(false)
      })
    })
  })

  test.describe('when reverse option is true', () => {
    test.before(async () => {
      domapic.stubs.module.config.get.resolves({
        reverse: true
      })
      domapic.utils.executeModuleListener(domapic.stubs.module)
      await domapic.utils.resolveOnStartCalled()
    })

    test.describe('switch state handler', () => {
      test.it('should return current sensor status inverted', () => {
        gpioIn.stubs.instance.status = true
        abilities = domapic.stubs.module.register.getCall(1).args[0]
        test.expect(abilities.switch.state.handler()).to.equal(false)
      })
    })

    test.describe('switch events listener', () => {
      test.it('should emit a domapic event with inverted value', () => {
        gpioIn.utils.getEventListener()(true)
        test.expect(domapic.stubs.module.events.emit).to.have.been.calledWith('switch', false)
      })
    })
  })

  test.describe('when ways option is 4', () => {
    test.before(async () => {
      gpioOut.stubs.instance.setStatus.reset()
      gpioOut.stubs.instance.init.reset()
      domapic.stubs.module.register.reset()
      domapic.stubs.module.config.get.resolves({
        ways: 4,
        relayGpio2: 2
      })
      domapic.utils.executeModuleListener(domapic.stubs.module)
      await domapic.utils.resolveOnStartCalled()
      abilities = domapic.stubs.module.register.getCall(0).args[0]
    })

    test.describe('when initializing', () => {
      test.it('should have inited a second relay', async () => {
        test.expect(gpioOut.stubs.instance.init).to.have.been.calledTwice()
      })
    })

    test.describe('switch action handler', () => {
      test.it('should toggle second relay if current status is different to target status', async () => {
        gpioIn.stubs.instance.status = true
        await abilities.switch.action.handler(false)
        test.expect(gpioOut.stubs.instance.setStatus).to.have.been.calledTwice()
      })
    })

    test.describe('relays action handler', () => {
      test.it('should change relay 2 status', async () => {
        await abilities.relaysSwitch.action.handler(false)
        test.expect(gpioOut.stubs.instance.setStatus.callCount).to.equal(4)
        test.expect(gpioOut.stubs.instance.setStatus).to.have.been.calledWith(false)
      })
    })
  })

  test.describe('when ways option is 4, and no second gpio is defined', () => {
    test.before(async () => {
      gpioOut.stubs.instance.setStatus.reset()
      gpioOut.stubs.instance.init.reset()
      domapic.stubs.module.register.reset()
      domapic.stubs.module.config.get.resolves({
        ways: 4
      })
    })

    test.it('should throw an error', async () => {
      let err
      try {
        await domapic.utils.executeModuleListener(domapic.stubs.module)
      } catch (error) {
        err = error
      }
      test.expect(err).to.be.an.instanceOf(Error)
    })
  })
})
