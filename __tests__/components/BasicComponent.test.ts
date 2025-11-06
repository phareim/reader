import { describe, it, expect } from '@jest/globals'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

// Create a simple test component inline
const SimpleComponent = defineComponent({
  name: 'SimpleComponent',
  props: {
    message: {
      type: String,
      default: 'Hello World'
    }
  },
  setup(props) {
    return () => h('div', { class: 'test-component' }, props.message)
  }
})

describe('Basic Vue Component Test', () => {
  it('should mount a simple component', () => {
    const wrapper = mount(SimpleComponent)
    expect(wrapper.exists()).toBe(true)
  })

  it('should render default message', () => {
    const wrapper = mount(SimpleComponent)
    expect(wrapper.text()).toBe('Hello World')
  })

  it('should render custom message from props', () => {
    const wrapper = mount(SimpleComponent, {
      props: {
        message: 'Custom Message'
      }
    })
    expect(wrapper.text()).toBe('Custom Message')
  })

  it('should have correct CSS class', () => {
    const wrapper = mount(SimpleComponent)
    expect(wrapper.classes()).toContain('test-component')
  })

  it('should find div element', () => {
    const wrapper = mount(SimpleComponent)
    const div = wrapper.find('div')
    expect(div.exists()).toBe(true)
  })
})
