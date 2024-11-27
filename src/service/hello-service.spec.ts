/**
 * `hello-service.spec.ts`
 * - common service for `hello-service`
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2024-11-27 initial version with `lemon-core#3.2.10`
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
import { loadProfile } from 'lemon-core/dist/environ';
import { GETERR, expect2 } from 'lemon-core';

//* import main models and service.
import { Model, ModelType, TestModel } from './hello-model';
import { HelloService } from './hello-service';

//*create service instance.
export const instance = (table = 'dummy', current?: number) => {
    current = current ?? new Date().getTime();
    const service = new HelloService(table === 'dummy' ? 'dummy-table.yml' : table);
    service.setCurrent(current);
    return { service, current };
};

//*main test body.
describe('hello-service /w dummy', () => {
    const PROFILE = loadProfile(process); // override process.env.
    PROFILE && console.info(`! PROFILE =`, PROFILE);

    it('should pass hello()', async () => {
        const { service } = instance('dummy');
        expect2(() => service.hello()).toEqual('hello-service');
    });
});

describe('model-manager in service', () => {
    //*test service w/ dummy data
    it('should pass test-manager w/ storage', async () => {
        const { service, current } = instance('dummy');
        const _ts = (type: ModelType): Model => ({
            ns: 'TT',
            type,
            createdAt: current,
            updatedAt: current,
            deletedAt: 0,
        });

        //*test service marking
        expect2(service.hello()).toEqual('hello-service');
        const FIELDS = (
            'id,stereo,name,count,' +
            'ns,type,sid,uid,gid,lock,next,meta,' +
            'createdAt,updatedAt,deletedAt,' +
            'error'
        )
            .split(',')
            .map(s => s.trim());
        expect2(() => service.$test.hello()).toEqual(
            `typed-storage-service:test/proxy-storage-service:dummy-storage-service:dummy-table/_id`,
        );
        expect2(() => service.$test.FIELDS).toEqual([...FIELDS]);

        //*test MyCoreManager of handling name.
        if (1) {
            const $test = service.$test;

            expect2(() => $test.validateName(null)).toEqual(false);
            expect2(() => $test.validateName('')).toEqual(false);
            expect2(() => $test.validateName('a')).toEqual(true);
            expect2(() => $test.validateName(' ')).toEqual(false);
            expect2(() => $test.validateName(2 as any)).toEqual(true);
            expect2(() => $test.validateName('abc')).toEqual(true);

            //*check w/ lookup
            expect2(await $test.$unique.updateLookup({ id: 'XYZ' }, 'X').catch(GETERR)).toEqual({
                ..._ts('test'),
                _id: 'TT:test:XYZ',
                id: 'XYZ',
                name: 'X',
            });

            expect2(() => $test.asIdByName('a')).toEqual('#name/a');
            expect2(() => $test.asIdByName(null)).toEqual('#name/');

            //*readByName
            expect2(await $test.findByName(undefined).catch(GETERR)).toEqual('@name (string) is required!');
            expect2(await $test.findByName(null).catch(GETERR)).toEqual('@name (string) is required!');
            expect2(await $test.findByName('').catch(GETERR)).toEqual('@name (string) is required!');
            expect2(await $test.findByName('a').catch(GETERR)).toEqual('404 NOT FOUND - test:name/a');
            expect2(await $test.findByName('abc').catch(GETERR)).toEqual('404 NOT FOUND - test:name/abc');
            expect2(await $test.findByName('   ').catch(GETERR)).toEqual('@name (   ) is not valid!');
            expect2(await $test.findByName(123 as any).catch(GETERR)).toEqual('@name (string) is required!');
            expect2(await $test.findByName({} as any).catch(GETERR)).toEqual('@name (string) is required!');

            //*updateName(model) with name 'abc'
            const model: TestModel = { id: 't01', name: 'test' };
            expect2(await $test.storage.read(model.id).catch(GETERR)).toEqual('404 NOT FOUND - _id:TT:test:t01');
            expect2(await $test.storage.read($test.asIdByName('abc')).catch(GETERR)).toEqual(
                '404 NOT FOUND - _id:TT:test:#name/abc',
            );
            expect2(await $test.findByName('abc').catch(GETERR)).toEqual('404 NOT FOUND - test:name/abc');
        }
    });
});
