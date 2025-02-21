/**********************************************************************************************************************
 *  Copyright 2020-2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                      *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.orglicenses/LICENSE-2.0                                                                     *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

"use strict"

const AWS = require('aws-sdk');
const sinon = require('sinon');
const expect = require('chai').expect;
const AWSMock = require('aws-sdk-mock');
const assert = require('assert');

const lambda = require('../index.js');
const _event_data = require('./event-feed-test-data');

describe('When scheduler triggers lambda', () => {
    beforeEach(() => {
        process.env.TABLE_NAMES = 'table1,table2,table3';
        process.env.DATABASE_NAME = 'testdb';
        process.env.AWS_SDK_USER_AGENT = '{ "cutomerAgent": "fakedata" }';
    });

    it('should create parition since one does not exist', async() => {
        AWSMock.mock('Glue', 'getPartition', (error, callback) => {
            let customError = new Error();
            customError.code = 'EntityNotFoundException';
            callback(customError, null);
        });

        AWSMock.mock('Glue', 'getTable', (error, callback) => {
            callback(null, {
                Table: {
                    StorageDescriptor: {
                        "Columns": [
                            {
                                "Name": "id_str",
                                "Type": "string"
                            },
                            {
                                "Name": "text",
                                "Type": "string"
                            },
                            {
                                "Name": "sentiment",
                                "Type": "string"
                            }
                        ],
                        "Location": "s3://testbucket/table1/",
                        "InputFormat": "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat",
                        "OutputFormat": "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat",
                        "Compressed": false,
                        "NumberOfBuckets": 0,
                        "SerdeInfo": {
                            "SerializationLibrary": "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
                        },
                        "SortColumns": [],
                        "StoredAsSubDirectories": true
                    }
                }
            });
        });

        AWSMock.mock('Glue', 'createPartition', (error, callback) => {
            callback(null, {});
        });

        expect (await lambda.handler(_event_data.event, _event_data.context)).to.be.undefined;

        AWSMock.restore('Glue');
    });

    it('should not create new parition since one exist', async() => {
        AWSMock.mock('Glue', 'getPartition', (error, callback) => {
            callback(null, {
                "DatabaseName": "testdb",
                "TableName": "table1",
                "PartitionInput": {
                    "StorageDescriptor": {
                        "Columns": [
                            {
                                "Name": "id_str",
                                "Type": "string"
                            },
                            {
                                "Name": "text",
                                "Type": "string"
                            },
                            {
                                "Name": "sentiment",
                                "Type": "string"
                            }
                        ],
                        "Location": "s3://testbucket/table1/",
                        "InputFormat": "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat",
                        "OutputFormat": "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat",
                        "Compressed": false,
                        "NumberOfBuckets": 0,
                        "SerdeInfo": {
                            "SerializationLibrary": "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
                        },
                        "SortColumns": [],
                        "StoredAsSubDirectories": true
                    },
                    "Parameters": {
                        "created_at": "2020-09-19"
                    },
                    "Values": [
                        "2020-09-19"
                    ]
                }
            });
        });

        expect(await lambda.handler(_event_data.event, _event_data.context)).to.be.undefined;

        AWSMock.restore('Glue');
    });

    it('should fail creating a new partition', async() => {
        AWSMock.mock('Glue', 'getPartition', (error, callback) => {
            let customError = new Error();
            customError.code = 'EntityNotFoundException';
            callback(customError, null);
        });

        AWSMock.mock('Glue', 'getTable', (error, callback) => {
            callback(null, {
                Table: {
                    StorageDescriptor: {
                        "Columns": [
                            {
                                "Name": "id_str",
                                "Type": "string"
                            },
                            {
                                "Name": "text",
                                "Type": "string"
                            },
                            {
                                "Name": "sentiment",
                                "Type": "string"
                            }
                        ],
                        "Location": "s3://testbucket/table1/",
                        "InputFormat": "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat",
                        "OutputFormat": "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat",
                        "Compressed": false,
                        "NumberOfBuckets": 0,
                        "SerdeInfo": {
                            "SerializationLibrary": "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
                        },
                        "SortColumns": [],
                        "StoredAsSubDirectories": true
                    }
                }
            });
        });

        AWSMock.mock('Glue', 'createPartition', (error, callback) => {
            callback(new Error('Fake error for failed parition creation'), null);
        });

        await lambda.handler(_event_data.event, _event_data.context).catch((error) => {
            if(error instanceof assert.AssertionError) {
                assert.fail();
            }
            assert(error.message, 'Fake error for failed parition creation');
        });

        AWSMock.restore('Glue');
    });

    afterEach(() => {
        delete process.env.TABLE_NAMES;
        delete process.env.DATABASE_NAME;
        delete process.env.AWS_SDK_USER_AGENT;
    });
});