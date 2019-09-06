import {ListDeleteElementMorph, Morph} from "../src/Morphs";

describe('ListDeleteElementMorph', () => {

    beforeEach(() => {
        Morph.reset();
    });

    it("should be creatable", () => {
        expect(new ListDeleteElementMorph(1, "test", "$", 3)).toBeTruthy();
    });

    it("should be able to delete top level list elements", () => {
        const list = [1, 2, 3, 4, 5];
        const length = list.length;

        new ListDeleteElementMorph(1, "test", "$", 3);

        Morph.cycle(list);

        expect(list.length).toBe(length - 1);
    });

    it("should be able to delete nested list elements", () => {
        const list = [1, 2, 3, 4, 5];
        const length = list.length;

        new ListDeleteElementMorph(1, "test", "$.data", 3);

        Morph.cycle({data: list});

        expect(list.length).toBe(length - 1);
    });

    it("should be able to delete from deeply nested lists", () => {
        const list = [1, 2, 3, 4, 5];
        const length = list.length;

        new ListDeleteElementMorph(1, "test", "$.foo[*].data", 3);

        Morph.cycle({foo: [{data: list}]});

        expect(list.length).toBe(length - 1);

    });

    it("should be able to delete from multiple deeply nested lists", () => {
        const list = [1, 2, 3, 4, 5];
        const length = list.length;
        const list2 = [1, 2, 3, 4, 5];
        const length2 = list2.length;

        new ListDeleteElementMorph(1, "test", "$.foo[*].data", 3);

        Morph.cycle({foo: [{data: list}, {data: list2}]});

        expect(list.length).toBe(length - 1);
        expect(list2.length).toBe(length2 - 1);
    });
});
