'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { dist, fixtures } = require('./helpers');
const {
	OMIT,
	ParameterError,
	buildInput,
	coerceParameter,
	humanize,
	mapperFields,
	mediaFields,
	missingRequiredMedia,
	promptFieldOf,
} = require(dist('nodes', 'PopNow', 'shared', 'schema.js'));

const schemaOf = (model) => fixtures[model].inputSchema;
const textToImage = schemaOf('alibaba/z-image-turbo/text-to-image');
const imageToVideo = schemaOf('bytedance/seedance-1.5-pro/image-to-video');
const textToSpeech = schemaOf('xai/grok-tts/text-to-speech');
const backgroundRemover = schemaOf('popnow/background-remover-v1/edit');
const imageEdit = schemaOf('alibaba/qwen-image-2.1/edit');

describe('promptFieldOf', () => {
	it('uses prompt when the model has one', () => {
		assert.equal(promptFieldOf(textToImage), 'prompt');
		assert.equal(promptFieldOf(imageToVideo), 'prompt');
	});

	it("uses a speech model's main text field", () => {
		assert.equal(promptFieldOf(textToSpeech), 'text');
	});

	it('has no target for models without free text', () => {
		assert.equal(promptFieldOf(backgroundRemover), undefined);
	});
});

describe('mediaFields', () => {
	it('finds single and list file inputs with their kinds', () => {
		const fields = mediaFields(imageEdit);
		const byName = Object.fromEntries(fields.map((field) => [field.name, field]));
		assert.equal(byName.image_urls.multiple, true);
		assert.equal(byName.image_urls.kind, 'image');
		assert.equal(byName.image_urls.required, true);
		assert.equal(byName.image_urls.maxItems, 10);
		assert.equal(byName.mask_url.multiple, false);
		assert.equal(byName.mask_url.required, false);
	});

	it('orders fields by x-ui.order, highest first', () => {
		assert.deepEqual(
			mediaFields(imageToVideo).map((field) => field.name),
			['image_url', 'last_image_url'],
		);
	});
});

describe('mapperFields', () => {
	it('leaves out the prompt and file inputs', () => {
		const ids = mapperFields(imageToVideo, ['prompt']).map((field) => field.id);
		assert.ok(!ids.includes('prompt'));
		assert.ok(!ids.includes('image_url'));
		assert.ok(!ids.includes('last_image_url'));
		assert.ok(ids.includes('duration_seconds'));
	});

	it('maps enums to options with their labels and keeps defaults', () => {
		const fields = mapperFields(textToImage, ['prompt']);
		const aspect = fields.find((field) => field.id === 'aspect_ratio');
		assert.equal(aspect.type, 'options');
		assert.deepEqual(
			aspect.options.map((option) => option.value),
			['1:1', '4:3', '3:4', '16:9', '9:16'],
		);
		assert.equal(aspect.defaultValue, '1:1');
		assert.equal(aspect.removed, false);

		const bitrate = mapperFields(textToSpeech, ['text']).find((field) => field.id === 'bitrate');
		assert.equal(bitrate.options.find((option) => option.value === 128000).name, '128 kbps');
	});

	it('shows numbers with their range and hides advanced fields until added', () => {
		const fields = mapperFields(imageToVideo, ['prompt']);
		const duration = fields.find((field) => field.id === 'duration_seconds');
		assert.equal(duration.type, 'number');
		assert.equal(duration.displayName, 'Duration Seconds (4 to 12 s)');
		const expansion = mapperFields(textToImage, ['prompt']).find(
			(field) => field.id === 'enable_prompt_expansion',
		);
		assert.equal(expansion.type, 'boolean');
		assert.equal(expansion.removed, true);
	});

	it('marks required fields and never offers them for matching', () => {
		const text = mapperFields(textToSpeech, []).find((field) => field.id === 'text');
		assert.equal(text.required, true);
		for (const field of mapperFields(textToSpeech, [])) {
			assert.equal(field.canBeUsedToMatch, false);
			assert.equal(field.defaultMatch, false);
			assert.equal(field.display, true);
		}
	});
});

describe('coerceParameter', () => {
	it('turns empty values into OMIT so the model default applies', () => {
		assert.equal(coerceParameter('seed', textToImage.properties.seed, ''), OMIT);
		assert.equal(coerceParameter('seed', textToImage.properties.seed, null), OMIT);
		assert.equal(coerceParameter('seed', textToImage.properties.seed, undefined), OMIT);
	});

	it('converts numbers, booleans and numeric enums from text', () => {
		assert.equal(coerceParameter('seed', textToImage.properties.seed, '42'), 42);
		assert.equal(
			coerceParameter('camera_fixed', imageToVideo.properties.camera_fixed, 'true'),
			true,
		);
		assert.equal(coerceParameter('bitrate', textToSpeech.properties.bitrate, '64000'), 64000);
		assert.equal(
			coerceParameter('aspect_ratio', textToImage.properties.aspect_ratio, '16:9'),
			'16:9',
		);
	});

	it('parses JSON for list fields and names the field when it is invalid', () => {
		const prop = { type: 'array', items: { type: 'object' } };
		assert.deepEqual(coerceParameter('loras', prop, '[{"path":"https://x/y.safetensors"}]'), [
			{ path: 'https://x/y.safetensors' },
		]);
		assert.throws(
			() => coerceParameter('loras', prop, '[oops'),
			(error) => {
				assert.ok(error instanceof ParameterError);
				assert.match(error.message, /'loras' must be valid JSON/);
				return true;
			},
		);
		assert.throws(
			() => coerceParameter('seed', textToImage.properties.seed, 'abc'),
			/must be a number/,
		);
	});
});

describe('buildInput', () => {
	it('assembles prompt, parameters and media, skipping empty values', () => {
		const input = buildInput({
			schema: imageToVideo,
			prompt: 'A paper boat drifting down a rain gutter',
			parameters: { duration_seconds: 5, resolution: '480p', seed: null, camera_fixed: false },
			media: { image_url: 'popnow://f/fil_1' },
		});
		assert.deepEqual(input, {
			prompt: 'A paper boat drifting down a rain gutter',
			duration_seconds: 5,
			resolution: '480p',
			camera_fixed: false,
			image_url: 'popnow://f/fil_1',
		});
	});

	it('lets the JSON box override everything else', () => {
		const input = buildInput({
			schema: textToImage,
			prompt: 'from the prompt box',
			parameters: { aspect_ratio: '1:1' },
			extra: { aspect_ratio: '9:16', prompt: 'from JSON' },
		});
		assert.equal(input.aspect_ratio, '9:16');
		assert.equal(input.prompt, 'from JSON');
	});

	it('sends the prompt box to the text field of a speech model', () => {
		const input = buildInput({ schema: textToSpeech, prompt: 'Welcome to the show.' });
		assert.deepEqual(input, { text: 'Welcome to the show.' });
	});

	it('refuses a prompt for a model that takes none', () => {
		assert.throws(
			() => buildInput({ schema: backgroundRemover, prompt: 'remove the background' }),
			/takes no text prompt/,
		);
		assert.deepEqual(buildInput({ schema: backgroundRemover, prompt: '   ' }), {});
	});

	it('reports required file inputs that are still missing', () => {
		const input = buildInput({ schema: imageToVideo, prompt: 'x' });
		assert.deepEqual(
			missingRequiredMedia(imageToVideo, input).map((field) => field.name),
			['image_url'],
		);
		const withUrl = buildInput({
			schema: imageToVideo,
			prompt: 'x',
			extra: { image_url: 'https://e.x/a.png' },
		});
		assert.deepEqual(missingRequiredMedia(imageToVideo, withUrl), []);
	});
});

describe('humanize', () => {
	it('turns wire names into labels', () => {
		assert.equal(humanize('reference_image_urls'), 'Reference Images');
		assert.equal(humanize('image_url'), 'Image');
		assert.equal(humanize('duration_seconds'), 'Duration Seconds');
	});
});

describe('startingPriceText', () => {
	const { startingPriceText } = require(dist('nodes', 'PopNow', 'methods.js'));

	it('formats the credit price the model list shows', () => {
		assert.equal(
			startingPriceText({ credits: { unit: 'per_image', perUnit: 2 } }),
			'from 2 credits/image',
		);
		assert.equal(
			startingPriceText({ credits: { unit: 'per_second', perUnit: 1 } }),
			'from 1 credit/s',
		);
		assert.equal(
			startingPriceText({ credits: { unit: 'per_1k_characters', perUnit: 3 } }),
			'from 3 credits/1K chars',
		);
		assert.equal(startingPriceText({}), '');
	});
});
